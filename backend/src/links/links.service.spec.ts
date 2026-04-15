import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LinksService } from './links.service';
import { ELASTICSEARCH_CLIENT } from '../elasticsearch/elasticsearch.module';

function makeEsMock() {
  return {
    indices: {
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn(),
    },
    search: jest.fn(),
    index: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
}

describe('LinksService', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('dev-tools-links'),
    get: jest.fn().mockReturnValue('http://localhost:9200'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('normalizes URLs for uniqueness', async () => {
    const es = makeEsMock();
    // No duplicates found
    es.search.mockResolvedValue({ hits: { total: { value: 0 }, hits: [] } });
    // Create succeeds
    es.index.mockResolvedValue({ result: 'created' });

    const svc = new LinksService(es as any, config);
    const res = await svc.create({
      title: 'Test',
      url: 'HTTPS://Example.com/path/#frag',
      icon: undefined,
      description: undefined,
      sortOrder: 0,
    });

    expect(res.url).toBe('https://example.com/path');
  });

  it('rejects duplicate URL', async () => {
    const es = makeEsMock();
    es.search.mockResolvedValue({ hits: { total: { value: 1 }, hits: [] } });

    const svc = new LinksService(es as any, config);
    await expect(
      svc.create({
        title: 'Test',
        url: 'https://example.com',
        icon: undefined,
        description: undefined,
        sortOrder: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

