import * as dotenv from 'dotenv';
dotenv.config({ debug: true });

import { CONFIG, ProductOrderCreate } from './config/config';
import { setup } from './setup/setup';
import { leadCspClient } from './utils/client';

const app = async () => {
	await setup();
	console.log('Sending product order...');
	const url = `${CONFIG.csp1Url}/tmf-api/productOrderingManagement/v1/productOrder`;
	try {
		const response = await leadCspClient.post(url, JSON.stringify(ProductOrderCreate));

		if (response?.status === 201) {
			console.log('successfully sent product order!');
			console.log(`Response product order: ${JSON.stringify(response?.data)}`);
		}
		// To hide heroku and tangle related timeout issues -> should be removed in the future
		// eslint-disable-next-line no-empty
	} catch (e) {}
};

app();
