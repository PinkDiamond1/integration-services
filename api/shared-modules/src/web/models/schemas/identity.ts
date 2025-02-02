import { Type } from '@sinclair/typebox';

export enum Encoding {
	base16 = 'base16',
	base58 = 'base58',
	base64 = 'base64'
}

export enum KeyTypes {
	ed25519 = 'ed25519',
	x25519 = 'x25519'
}

export const VerifiableCredentialSubjectSchema = Type.Object(
	{
		id: Type.String({ minLength: 50, maxLength: 53 }),
		type: Type.String({ minLength: 1 }),
		initiator: Type.Optional(Type.String({ minLength: 50, maxLength: 53 }))
	},
	{
		additionalProperties: true
	}
);

export const VerifiableCredentialSchema = Type.Object(
	{
		'@context': Type.String(),
		id: Type.String({ minLength: 50, maxLength: 53 }),
		type: Type.Array(Type.String({ minLength: 1 })),
		credentialSubject: VerifiableCredentialSubjectSchema,
		issuer: Type.String({ minLength: 50, maxLength: 53 }),
		issuanceDate: Type.String({ minLength: 1, format: 'date-time' }),
		credentialStatus: Type.Optional(
			Type.Object({
				id: Type.String(),
				type: Type.String(),
				revocationBitmapIndex: Type.String()
			})
		),
		proof: Type.Object({
			type: Type.String({ minLength: 1 }),
			verificationMethod: Type.String({ minLength: 1 }),
			signatureValue: Type.String({ minLength: 1 })
		})
	},
	{
		additionalProperties: true
	}
);

export const IdentityDocumentSchema = Type.Object({
	doc: Type.Object({
		id: Type.String({ minLength: 50, maxLength: 53 }),
		capabilityInvocation: Type.Array(
			Type.Object({
				id: Type.String(),
				controller: Type.String({ minLength: 50, maxLength: 53 }),
				type: Type.String(),
				publicKeyMultibase: Type.String()
			})
		),
		service: Type.Optional(
			Type.Array(
				Type.Object({
					id: Type.String(),
					type: Type.String(),
					serviceEndpoint: Type.String()
				})
			)
		)
	}),
	meta: Type.Object({
		created: Type.String({ format: 'date-time', minLength: 1 }),
		updated: Type.String({ format: 'date-time', minLength: 1 }),
		previousMessageId: Type.Optional(Type.String())
	}),
	proof: Type.Object({
		type: Type.String(),
		verificationMethod: Type.String(),
		signatureValue: Type.String()
	}),
	integrationMessageId: Type.Optional(Type.String())
});

export const IdentityKeyPairSchema = Type.Object({
	type: Type.String(),
	public: Type.String(),
	private: Type.String(),
	encoding: Type.Enum(Encoding)
});

export const KeysSchema = Type.Object({
	sign: IdentityKeyPairSchema,
	encrypt: Type.Optional(IdentityKeyPairSchema)
});

export const IdentityKeysSchema = Type.Object({
	id: Type.String(),
	keys: KeysSchema
});
