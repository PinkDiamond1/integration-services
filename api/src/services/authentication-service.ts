import { KEY_COLLECTION_INDEX, KEY_COLLECTION_SIZE } from '../config/identity';
import { getIdentity, saveIdentity, updateIdentityDoc } from '../database/identities';
import { getKeyCollection, saveKeyCollection } from '../database/key-collection';
import {
  addKeyCollectionIdentity,
  getKeyCollectionIdentity,
  getLinkedIdentitesSize,
  revokeKeyCollectionIdentity
} from '../database/key-collection-links';
import { KeyCollectionJson, KeyCollectionPersistence } from '../models/data/key-collection';
import { CreateIdentityBody, IdentityDocumentJson, IdentityResponse, UserCredential } from '../models/data/identity';
import { User, VerificationUpdatePersistence } from '../models/data/user';
import { getDateFromString } from '../utils/date';
import { Credential, IdentityService } from './identity-service';
import { UserService } from './user-service';

export class AuthenticationService {
  identityService: IdentityService;
  userService: UserService;
  constructor(identityService: IdentityService, userService: UserService) {
    this.identityService = identityService;
    this.userService = userService;
  }

  saveKeyCollection(keyCollection: KeyCollectionPersistence) {
    return saveKeyCollection(keyCollection);
  }

  getKeyCollection(index: number) {
    return getKeyCollection(index);
  }

  generateKeyCollection = async (issuerId: string): Promise<KeyCollectionPersistence> => {
    const issuerIdentity: IdentityResponse = await getIdentity(issuerId);
    const { kcp, doc } = await this.identityService.generateKeyCollection(issuerIdentity, KEY_COLLECTION_INDEX, KEY_COLLECTION_SIZE);
    console.log('key collection doc:', doc.toJSON());
    await this.updateDatabaseIdentityDoc(doc.toJSON());
    return kcp;
  };

  createIdentity = async (createIdentityBody: CreateIdentityBody): Promise<IdentityResponse> => {
    const identity = await this.identityService.createIdentity();
    const user: User = {
      ...createIdentityBody,
      userId: identity.doc.id.toString(),
      publicKey: identity.key.public
    };

    const result = await this.userService.addUser(user);

    if (createIdentityBody.storeIdentity) {
      const res = await saveIdentity(identity);
      if (!res.result.n) {
        console.log('Could not save identity!');
      }
    }

    if (!result?.result?.n) {
      throw new Error('Could not create user identity!');
    }
    return {
      ...identity
    };
  };

  createVerifiableCredential = async (userCredential: UserCredential, issuerId: string) => {
    const user = await this.userService.getUser(userCredential.id);
    if (!user) {
      throw new Error("User does not exist, so he can't be verified!");
    }

    const credential: Credential<UserCredential> = {
      type: 'UserCredential',
      id: userCredential.id,
      subject: {
        ...userCredential
      }
    };
    const keyCollection = await this.getKeyCollection(KEY_COLLECTION_INDEX);
    const index = await getLinkedIdentitesSize(KEY_COLLECTION_INDEX);
    const keyCollectionJson: KeyCollectionJson = {
      type: keyCollection.type,
      keys: keyCollection.keys
    };

    const issuerIdentity: IdentityResponse = await getIdentity(issuerId);
    console.log('issuerIdentity', issuerIdentity);

    const rs = await this.identityService.createVerifiableCredential<UserCredential>(issuerIdentity, credential, keyCollectionJson, index);
    await this.updateDatabaseIdentityDoc(rs.newIdentityDoc?.toJSON());

    const res = await addKeyCollectionIdentity({
      index,
      isRevoked: false,
      linkedIdentity: userCredential.id,
      keyCollectionIndex: KEY_COLLECTION_INDEX
    });
    if (!res?.result?.n) {
      throw new Error('Could not verify identity!');
    }
    await this.setUserVerified(credential.id, rs?.validatedCredential?.issuer?.did?.toString());
    return rs?.validatedCredential;
  };

  checkVerifiableCredential = async (vc: any, issuerId: string) => {
    const issuerIdentity: IdentityResponse = await getIdentity(issuerId);
    const res = await this.identityService.checkVerifiableCredential(issuerIdentity, vc);
    const user = await this.userService.getUser(vc?.id);
    const vup: VerificationUpdatePersistence = {
      userId: vc?.id,
      verified: res?.verified, // TODO!!!
      lastTimeChecked: new Date(),
      verificationDate: getDateFromString(user?.verification?.verificationDate),
      verificationIssuerId: user?.verification?.verificationIssuerId
    };
    const uvUpdate = await this.userService.updateUserVerification(vup);
    if (!uvUpdate?.result.n) {
      throw new Error('Could not update identity verification');
    }
    return res;
  };

  revokeVerifiableCredential = async (did: string, issuerId: string) => {
    const kci = await getKeyCollectionIdentity(did);
    if (!kci) {
      throw new Error('No identity found to revoke the verification!');
    }
    const issuerIdentity: IdentityResponse = await getIdentity(issuerId);
    const res = await this.identityService.revokeVerifiableCredential(issuerIdentity, kci.index);
    const newDoc = res.newIdentityDoc;
    await this.updateDatabaseIdentityDoc(newDoc.toJSON());

    // TODO clarify in which situation this is true or false!
    if (res.revoked === true) {
      console.log('Successfully revoked!');
    } else {
      console.log(`Could not revoke identity for ${did} on the ledger!`);
    }

    const updateRes = await revokeKeyCollectionIdentity(kci);
    if (!updateRes?.result.n) {
      throw new Error('could not revoke identity');
    }

    const vup: VerificationUpdatePersistence = {
      userId: did,
      verified: false,
      lastTimeChecked: new Date(),
      verificationDate: undefined,
      verificationIssuerId: undefined
    };
    const uvUpdate = await this.userService.updateUserVerification(vup);
    if (!uvUpdate?.result.n) {
      throw new Error('could not revoke identity');
    }
    return res;
  };

  updateDatabaseIdentityDoc = async (idenitityDoc: IdentityDocumentJson) => {
    const res = await updateIdentityDoc(idenitityDoc);
    if (!res.result.n) {
      throw new Error('could not update identity!');
    }
  };

  getLatestDocument = async (did: string) => {
    return await this.identityService.getLatestIdentity(did);
  };

  private setUserVerified = async (userId: string, issuerId: string) => {
    if (!issuerId) {
      throw new Error('No valid issuer id!');
    }
    const date = new Date();
    const vup: VerificationUpdatePersistence = {
      userId,
      verified: true,
      lastTimeChecked: date,
      verificationDate: date,
      verificationIssuerId: issuerId
    };
    const res = await this.userService.updateUserVerification(vup);
    if (!res?.result?.n) {
      throw new Error('Could not udpate user verification!');
    }
  };
}
