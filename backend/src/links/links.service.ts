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

  private isEsConflict(err: unknown): boolean {
    if (err instanceof errors.ResponseError) return err.statusCode === 409;
    const anyErr = err as any;
    return (
      anyErr?.statusCode === 409 ||
      anyErr?.meta?.statusCode === 409 ||
      anyErr?.body?.status === 409
    );
  }

  private normalizeUrl(url: string): string {
    const raw = url.trim();
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new BadRequestException(
        'Please enter a valid URL (including https://)',
      );
    }

    // Canonicalize for uniqueness: lowercase scheme/host, drop fragment, drop default ports, drop trailing slash.
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    u.pathname = u.pathname.replace(/\/+$/, '');

    // Build a stable canonical string; URL.toString() re-adds "/" for empty paths.
    const origin = u.origin;
    const path = u.pathname || '';
    const search = u.search || '';
    return `${origin}${path}${search}`;
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
      if (this.isEsConflict(e)) {
        throw new ConflictException('A link with this URL already exists');
      }
      throw e;
    }
    return { id, ...doc };
  }

  async update(id: string, dto: UpdateLinkDto): Promise<LinkEntity> {
    const doc = await this.findOne(id);
    const storedUrl = this.normalizeUrl(doc.url);
    const nextUrl = dto.url !== undefined ? this.normalizeUrl(dto.url) : storedUrl;
    const urlChanged = nextUrl !== storedUrl;

    const next: LinkDocument = {
      title: dto.title ?? doc.title,
      url: nextUrl,
      icon: dto.icon !== undefined ? dto.icon : doc.icon,
      description:
        dto.description !== undefined ? dto.description : doc.description,
      sortOrder: dto.sortOrder ?? doc.sortOrder,
    };

    if (!urlChanged) {
      await this.es.index({
        index: this.indexName,
        id,
        document: next,
        refresh: 'wait_for',
      });
      return { id, ...next };
    }

    // URL changed => ID changes (uniqueness enforced by deterministic ID + op_type=create).
    const nextId = this.urlToId(nextUrl);
    if (nextId !== id) {
      const alreadyExists = await this.es.exists({
        index: this.indexName,
        id: nextId,
      });
      if (alreadyExists === true) {
        throw new ConflictException('A link with this URL already exists');
      }
    }
    try {
      await this.es.index({
        index: this.indexName,
        id: nextId,
        document: next,
        op_type: 'create',
        refresh: 'wait_for',
      });
    } catch (e: unknown) {
      if (this.isEsConflict(e)) {
        throw new ConflictException('A link with this URL already exists');
      }
      throw e;
    }

    // Best-effort delete of old doc after creating the new one.
    try {
      await this.es.delete({
        index: this.indexName,
        id,
        refresh: 'wait_for',
      });
    } catch (e: unknown) {
      this.logger.warn(
        `Link URL changed and new doc was created, but deleting old doc failed (id=${id}).`,
      );
    }

    return { id: nextId, ...next };
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
