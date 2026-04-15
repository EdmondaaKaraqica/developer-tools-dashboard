import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LinksService } from './links.service';

function makeEsMock() {
  return {
    indices: {
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn(),
    },
    search: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
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
    es.index.mockRejectedValue({ statusCode: 409 });

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

  it('updates URL by creating new id and deleting old', async () => {
    const es = makeEsMock();
    es.get.mockResolvedValue({
      _id: 'old',
      _source: { title: 'A', url: 'https://example.com', sortOrder: 0 },
    });
    es.exists.mockResolvedValue(false);
    es.index.mockResolvedValue({ result: 'created' });
    es.delete.mockResolvedValue({ result: 'deleted' });

    const svc = new LinksService(es as any, config);
    const updated = await svc.update('old', { url: 'https://example.com/new' });

    expect(updated.url).toBe('https://example.com/new');
    expect(es.delete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old' }),
    );
  });

  it('rejects changing URL to an existing one', async () => {
    const es = makeEsMock();
    es.get.mockResolvedValue({
      _id: 'old',
      _source: { title: 'A', url: 'https://example.com', sortOrder: 0 },
    });
    es.exists.mockResolvedValue(true);

    const svc = new LinksService(es as any, config);
    await expect(
      svc.update('old', { url: 'https://example.com/existing' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

