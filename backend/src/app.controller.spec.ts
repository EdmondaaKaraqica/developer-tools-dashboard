import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { LinksService } from './links/links.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: LinksService,
          useValue: { ensureIndex: async () => {} },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('health', () => {
    expect(appController.health()).toEqual({ status: 'ok' });
  });

  it('ready', async () => {
    await expect(appController.ready()).resolves.toEqual({ status: 'ready' });
  });
});
