import { StatusCodes } from 'http-status-codes';
import { SubscriptionRoutes } from '..';
import { Subscription, AccessRights, SubscriptionType } from '@iota/is-shared-modules';
import { ChannelInfoService } from '../../../services/channel-info-service';
import { StreamsService } from '../../../services/streams-service';
import { SubscriptionService } from '../../../services/subscription-service';
import { StreamsConfigMock } from '../../../test/mocks/config';
import { LoggerMock } from '../../../test/mocks/logger';
import * as SubscriptionDb from '../../../database/subscription';
import * as ChannelDataDb from '../../../database/channel-data';
import * as ChannelInfoDb from '../../../database/channel-info';
import { AuthorMock } from '../../../test/mocks/streams';

describe('test revoke subscription route', () => {
	let sendMock: any, sendStatusMock: any, nextMock: any, res: any;
	let subscriptionRoutes: SubscriptionRoutes, streamsService: StreamsService;
	let channelInfoService: ChannelInfoService, subscriptionService: SubscriptionService;

	const subscriptionMock: Subscription = {
		channelAddress: 'testaddress',
		id: 'did:iota:1234',
		isAuthorized: false,
		publicKey: 'testpublickey',
		state: 'teststate',
		subscriptionLink: 'testlink',
		accessRights: AccessRights.ReadAndWrite,
		keyloadLink: 'testkeyloadlink',
		sequenceLink: 'testsequencelink',
		type: SubscriptionType.Subscriber
	};

	const authorSubscriptionMock: Subscription = {
		channelAddress: 'testaddress',
		id: 'did:iota:2345',
		isAuthorized: true,
		publicKey: 'test-author-public-key',
		state: 'teststate2',
		subscriptionLink: 'testlink2',
		accessRights: AccessRights.ReadAndWrite,
		keyloadLink: 'testkeyloadlink2',
		sequenceLink: 'testsequencelink2',
		type: SubscriptionType.Author
	};
	beforeEach(() => {
		sendMock = jest.fn();
		sendStatusMock = jest.fn();
		nextMock = jest.fn();
		const config = StreamsConfigMock;
		streamsService = new StreamsService(config, LoggerMock);
		jest.spyOn(streamsService, 'getMessages').mockImplementation(async () => []);
		channelInfoService = new ChannelInfoService();
		subscriptionService = new SubscriptionService(streamsService, channelInfoService, config);
		subscriptionRoutes = new SubscriptionRoutes(subscriptionService, channelInfoService, LoggerMock);
		jest.spyOn(ChannelDataDb, 'addChannelData').mockImplementation(async () => null);
		res = {
			send: sendMock,
			sendStatus: sendStatusMock,
			status: jest.fn(() => res)
		};
	});

	it('should call nextMock if no body is provided', async () => {
		const loggerSpy = jest.spyOn(LoggerMock, 'error');
		const req: any = {
			params: {},
			user: { id: undefined },
			body: undefined // no body
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);
		expect(loggerSpy).toHaveBeenCalled();
		expect(nextMock).toHaveBeenCalledWith(new Error('could not revoke the subscription'));
	});

	it('should bad request if no id is provided', async () => {
		const req: any = {
			params: {},
			user: { id: undefined }, //no id,
			body: {}
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);
		expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
		expect(res.send).toHaveBeenCalledWith({ error: 'no channelAddress or id provided' });
	});

	it('should return error if no author is found', async () => {
		jest.spyOn(subscriptionService, 'getSubscription').mockImplementation(async () => null); // no author found to authorize
		jest.spyOn(subscriptionService, 'getSubscriptionByLink').mockImplementation(async () => null); // no subscription found to authorize
		const req: any = {
			params: { channelAddress: 'testaddress' },
			user: { id: 'did:iota:2345' },
			body: {}
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);
		expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
		expect(res.send).toHaveBeenCalledWith({ error: 'subscription must be an author' });
	});

	it('should return error if no subscription using the link is found to authorize', async () => {
		const loggerSpy = jest.spyOn(LoggerMock, 'error');
		jest
			.spyOn(subscriptionService, 'getSubscription')
			.mockImplementationOnce(async () => authorSubscriptionMock)
			.mockImplementationOnce(async () => null); // no subscription found to authorize
		const getSubscriptionByLinkSpy = jest.spyOn(subscriptionService, 'getSubscriptionByLink').mockReturnValue(null); // no subscription found to authorize
		const req: any = {
			params: { channelAddress: 'testaddress' },
			user: { id: 'did:iota:2345' },
			body: { subscriptionLink: 'wrongsubscriptionlink' }
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);

		expect(getSubscriptionByLinkSpy).toHaveBeenCalledWith('wrongsubscriptionlink');
		expect(loggerSpy).toHaveBeenCalledWith(new Error('no valid subscription found!'));
		expect(nextMock).toHaveBeenCalledWith(new Error('could not revoke the subscription'));
	});

	it('should return ok if revokedSubscription is mocked', async () => {
		jest
			.spyOn(subscriptionService, 'getSubscription')
			.mockImplementationOnce(async () => authorSubscriptionMock)
			.mockImplementationOnce(async () => subscriptionMock);
		const revokeSubscriptionSpy = jest.spyOn(subscriptionService, 'revokeSubscription').mockImplementation(async () => null);
		const req: any = {
			params: { channelAddress: 'testaddress' },
			user: { id: 'did:iota:1234' },
			body: { id: 'did:iota:2345' }
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);
		expect(revokeSubscriptionSpy).toHaveBeenCalledWith('testaddress', subscriptionMock, authorSubscriptionMock);
		expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.OK);
	});

	it('should return bad request since subscription is already authorized', async () => {
		const loggerSpy = jest.spyOn(LoggerMock, 'error');
		jest
			.spyOn(subscriptionService, 'getSubscription')
			.mockImplementationOnce(async () => authorSubscriptionMock)
			.mockImplementationOnce(async () => subscriptionMock);
		jest.spyOn(streamsService, 'importSubscription').mockReturnValue(null); // no author
		const req: any = {
			params: { channelAddress: 'testaddress' },
			user: { id: 'did:iota:1234' },
			body: { id: 'did:iota:2345' }
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);
		expect(loggerSpy).toHaveBeenCalledWith(new Error('no author found with channelAddress: testaddress and id: did:iota:2345'));
		expect(nextMock).toHaveBeenCalledWith(new Error('could not revoke the subscription'));
	});

	it('should revoke the subscription', async () => {
		const channelAddress = 'testaddress';
		jest
			.spyOn(subscriptionService, 'getSubscription')
			.mockImplementationOnce(async () => authorSubscriptionMock)
			.mockImplementationOnce(async () => subscriptionMock);

		const updateSubscriptionStateSpy = jest.spyOn(subscriptionService, 'updateSubscriptionState').mockImplementation(async () => null);
		const sendKeyloadSpy = jest.spyOn(streamsService, 'sendKeyload').mockImplementation(async () => ({
			keyloadLink: 'testkeyloadlink',
			sequenceLink: 'testsequencelink',
			author: AuthorMock
		}));
		const removeChannelRequestedSubscriptionIdSpy = jest.spyOn(ChannelInfoDb, 'removeChannelRequestedSubscriptionId').mockImplementation(async () => null);
		const exportSubscriptionSpy = jest.spyOn(streamsService, 'exportSubscription').mockReturnValue('new-state');
		const setSubscriptionAuthorizedSpy = jest.spyOn(subscriptionService, 'setSubscriptionAuthorized').mockImplementation(async () => null);
		const removeSubscriptionSpy = jest.spyOn(SubscriptionDb, 'removeSubscription').mockImplementation(async () => null);
		const removeChannelDataSpy = jest.spyOn(ChannelDataDb, 'removeChannelData').mockImplementation(async () => null);

		jest.spyOn(streamsService, 'importSubscription').mockImplementation(async () => AuthorMock);
		const getSubscriptionsSpy = jest
			.spyOn(SubscriptionDb, 'getSubscriptions')
			.mockImplementation(async () => [authorSubscriptionMock, subscriptionMock]);

		const req: any = {
			params: { channelAddress },
			user: { id: 'did:iota:1234' },
			body: { id: 'did:iota:2345' }
		};

		await subscriptionRoutes.revokeSubscription(req, res, nextMock);

		expect(getSubscriptionsSpy).toHaveBeenCalledWith(channelAddress);
		expect(sendKeyloadSpy).toHaveBeenCalledWith(
			'testsequencelink2',
			['test-author-public-key', 'test-author-public-key'],
			AuthorMock,
			authorSubscriptionMock.pskId
		);
		expect(setSubscriptionAuthorizedSpy).toHaveBeenCalledWith(
			channelAddress,
			authorSubscriptionMock.id,
			'testkeyloadlink',
			'testsequencelink'
		);
		expect(removeSubscriptionSpy).toHaveBeenCalledWith(channelAddress, subscriptionMock.id);
		expect(removeChannelDataSpy).toHaveBeenCalledWith(channelAddress, subscriptionMock.id);
		expect(removeChannelRequestedSubscriptionIdSpy).toHaveBeenCalledWith(channelAddress, subscriptionMock.id);
		expect(updateSubscriptionStateSpy).toHaveBeenCalledWith(channelAddress, authorSubscriptionMock.id, 'new-state');
		expect(exportSubscriptionSpy).toHaveBeenCalledWith(AuthorMock, 'veryvery-very-very-server-secret');
		expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.OK);
	});
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});
});
