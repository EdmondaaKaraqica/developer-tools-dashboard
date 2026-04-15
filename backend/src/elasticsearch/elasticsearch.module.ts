import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: (config: ConfigService) =>
        new Client({
          node: config.getOrThrow<string>('ELASTICSEARCH_NODE'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [ELASTICSEARCH_CLIENT],
})
export class ElasticsearchModule {}
