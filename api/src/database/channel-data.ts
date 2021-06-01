import { CollectionNames } from './constants';
import { MongoDbService } from '../services/mongodb-service';
import { ChannelData } from '../models/types/channel-data';

const collectionName = CollectionNames.channelData;
const getIndex = (link: string, userId: string) => `${link}-${userId}`;

export const getChannelData = async (
	channelAddress: string,
	userId: string,
	limit?: number,
	index?: number
): Promise<{ link: string; maskedPayload: string; publicPayload: string }[]> => {
	const query = { channelAddress, userId };
	const skip = index > 0 ? index * limit : 0;
	const options = limit != null ? { limit, skip, sort: { creationDate: 1 } } : undefined;

	const channelData = await MongoDbService.getDocuments<any>(collectionName, query, options);
	return channelData.map(({ link, maskedPayload, publicPayload }) => ({ link, maskedPayload, publicPayload }));
};

export const addChannelData = async (channelAddress: string, userId: string, channelData: ChannelData[]): Promise<void> => {
	const documents = channelData.map((data) => {
		return {
			_id: getIndex(data.link, userId),
			channelAddress,
			userId,
			...data
		};
	});

	const res = await MongoDbService.insertDocuments(collectionName, documents);
	if (!res?.result?.n) {
		throw new Error('could not add channel data!');
	}
};