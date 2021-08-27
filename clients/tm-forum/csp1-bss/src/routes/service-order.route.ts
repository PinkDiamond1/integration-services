import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { hashNonce } from '../utils/encryption';
import { writeChannel } from '../services/channel.service';
import { forwardSlaViolation } from '../services/violation.service';
import { ViolationRules } from '../config/config';
export class ServiceOrderRoutes {
	/**
	 * Writes received serviceOrderCreateEvent to the tangle
	 * @param req with serviceOrderCreateEvent on body
	 * @param res return OK (200)
	 */
	writeServiceOrderCreateEvent = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
		try {
			console.log('Received service order create event...');
			
			const serviceOrderCreateEvent = req.body;
			const hashedData = hashNonce(JSON.stringify(serviceOrderCreateEvent));
			const payload = { hashedData };
			await writeChannel(payload, 'serviceOrderCreateEvent');
			res.status(StatusCodes.OK).send();

			// TODO here we then create the SLA which will be stored in the tangle and then sent to POST /tmf-api/slaManagement/v1/sla
			console.log('Creating sla violation rules...');
			const slaViolationRules = ViolationRules;
			await forwardSlaViolation(slaViolationRules);
			await writeChannel(ViolationRules, 'createSlaViolationRules');

			return			
		} catch (error) {
			console.log(error);
			next(new Error('Could not write service order create event'));
		}
	};
}
