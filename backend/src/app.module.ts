import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { LinksModule } from './links/links.module';

/** Next to package.json so env loads even if the shell cwd is not `backend/`. */
const envDir = join(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(envDir, '.env'), join(envDir, '.env.example')],
    }),
    ElasticsearchModule,
    AuthModule,
    LinksModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
