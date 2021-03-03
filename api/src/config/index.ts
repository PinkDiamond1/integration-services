import { Config, IdentityConfig } from '../models/config';
import isEmpty from 'lodash/isEmpty';
import * as Identity from '@iota/identity-wasm/node';

const IdentityConfig: IdentityConfig = {
  network: process.env.NETWORK,
  node: process.env.IOTA_PERMA_NODE,
  explorer: process.env.EXPLORER,
  keyType: Identity.KeyType.Ed25519,
  keyCollectionTag: 'key-collection'
};

export const CONFIG: Config = {
  port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,
  apiVersion: process.env.API_VERSION,
  databaseUrl: process.env.DATABASE_URL,
  databaseName: process.env.DATABASE_NAME,
  identityConfig: {
    ...IdentityConfig
  }
};

const assertConfig = (config: Config) => {
  Object.values(config).map((value, i) => {
    if (isEmpty(value) && (isNaN(value) || value == null || value === '')) {
      console.log('========================================================');
      console.error('Env var is missing or invalid:', Object.keys(config)[i]);
      console.log('========================================================');
    }
  });
};

assertConfig(CONFIG);
