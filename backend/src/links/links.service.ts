import { Client, errors } from '@elastic/elasticsearch';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ELASTICSEARCH_CLIENT } from '../elasticsearch/elasticsearch.module';
import { Inject } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

export interface LinkDocument {
  title: string;
  url: string;
  icon?: string;
  description?: string;
  sortOrder: number;
}

export interface LinkEntity extends LinkDocument {
  id: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class LinksService implements OnModuleInit {
  private readonly logger = new Logger(LinksService.name);
  private indexName: string;

  private normalizeUrl(url: string): string {
    const raw = url.trim();
    const u = new URL(raw);

    // Canonicalize for uniqueness: lowercase scheme/host, drop fragment, drop default ports, drop trailing slash (except root)
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    if (u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }

    return u.toString();
  }

  private urlToId(url: string): string {
    // Deterministic ID makes URL uniqueness trivial (same URL => same document ID).
    return createHash('sha256').update(url).digest('hex');
  }

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly es: Client,
    private readonly config: ConfigService,
  ) {
    this.indexName = this.config.getOrThrow<string>('ELASTICSEARCH_INDEX');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIndex();
  }

  async ensureIndex(): Promise<void> {
    const node = this.config.get<string>('ELASTICSEARCH_NODE');
    try {
      const exists = await this.es.indices.exists({ index: this.indexName });
      if (exists !== true) {
        await this.es.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              title: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              url: { type: 'keyword' },
              icon: { type: 'keyword', ignore_above: 2048 },
              description: { type: 'text' },
              sortOrder: { type: 'integer' },
            },
          },
        });
      }
    } catch (err: unknown) {
      const hint =
        'Start Elasticsearch first, e.g. from the repo root: docker compose up -d elasticsearch';
      this.logger.error(
        `Cannot connect to Elasticsearch at "${node ?? '(unset)'}". ${hint}`,
        err instanceof Error ? err.stack : err,
      );
      throw new Error(
        `Elasticsearch connection failed (${node ?? 'ELASTICSEARCH_NODE'}). ${hint}`,
      );
    }
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<LinkEntity>> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 10));
    const from = (page - 1) * pageSize;

    const res = await this.es.search<LinkDocument>({
      index: this.indexName,
      from,
      size: pageSize,
      sort: [{ sortOrder: 'asc' }, { 'title.keyword': 'asc' }],
      query: { match_all: {} },
      track_total_hits: true,
    });
    const hits = res.hits.hits ?? [];
    const items = hits
      .filter((h) => h._id && h._source)
      .map((h) => {
        const src = h._source;
        if (!src) throw new InternalServerErrorException('Invalid hit');
        return { id: h._id as string, ...src };
      });

    const total =
      typeof res.hits.total === 'number'
        ? res.hits.total
        : (res.hits.total?.value ?? items.length);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { items, page, pageSize, total, totalPages };
  }

  async findOne(id: string): Promise<LinkEntity> {
    try {
      const res = await this.es.get<LinkDocument>({
        index: this.indexName,
        id,
      });
      const src = res._source;
      if (!src) throw new NotFoundException('Link not found');
      return { id: res._id as string, ...src };
    } catch (e: unknown) {
      if (e instanceof errors.ResponseError && e.statusCode === 404) {
        throw new NotFoundException('Link not found');
      }
      throw e;
    }
  }

  async create(dto: CreateLinkDto): Promise<LinkEntity> {
    const normalizedUrl = this.normalizeUrl(dto.url);
    const id = this.urlToId(normalizedUrl);
    const doc: LinkDocument = {
      title: dto.title,
      url: normalizedUrl,
      icon: dto.icon,
      description: dto.description,
      sortOrder: dto.sortOrder ?? 0,
    };
    // Guard against duplicates even if older docs used a different normalization.
    const dup = await this.es.search<LinkDocument>({
      index: this.indexName,
      size: 0,
      query: {
        bool: {
          should: [
            { term: { url: normalizedUrl } },
            { term: { url: dto.url.trim() } },
          ],
          minimum_should_match: 1,
        },
      },
      track_total_hits: true,
    });
    const dupCount =
      typeof dup.hits.total === 'number' ? dup.hits.total : (dup.hits.total?.value ?? 0);
    if (dupCount > 0) {
      throw new ConflictException('A link with this URL already exists');
    }
    try {
      const res = await this.es.index({
        index: this.indexName,
        id,
        document: doc,
        op_type: 'create',
        refresh: 'wait_for',
      });
      if (res.result !== 'created') {
        throw new InternalServerErrorException('Failed to create link');
      }
    } catch (e: unknown) {
      if (e instanceof errors.ResponseError && e.statusCode === 409) {
        throw new ConflictException('A link with this URL already exists');
      }
      throw e;
    }
    return { id, ...doc };
  }

  async update(id: string, dto: UpdateLinkDto): Promise<LinkEntity> {
    const doc = await this.findOne(id);
    const storedUrl = this.normalizeUrl(doc.url);
    if (dto.url !== undefined) {
      const nextUrl = this.normalizeUrl(dto.url);
      if (nextUrl !== storedUrl) {
        throw new BadRequestException(
          'URL is immutable. Delete and recreate the link to change the URL.',
        );
      }
    }
    const next: LinkDocument = {
      title: dto.title ?? doc.title,
      url: storedUrl,
      icon: dto.icon !== undefined ? dto.icon : doc.icon,
      description:
        dto.description !== undefined ? dto.description : doc.description,
      sortOrder: dto.sortOrder ?? doc.sortOrder,
    };
    await this.es.index({
      index: this.indexName,
      id,
      document: next,
      refresh: 'wait_for',
    });
    return { id, ...next };
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.es.delete({
      index: this.indexName,
      id,
      refresh: 'wait_for',
    });
  }
}
