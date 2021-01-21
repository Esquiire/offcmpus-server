import { prop, getModelForClass } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"
import { ID } from "type-graphql"
import { APIResult } from '.'

@ObjectType()
class S3Document {

    // The mime of document. (e.g application/pdf, image/png, etc.)
    @Field(() => String)
    @prop({type: String})
    mime_type: string;

    // the key that identifies this document in the s3 bucket
    @Field(() => String)
    @prop({type: String})
    s3_key: string;
}

/**
 * When a landlord creates a lease for one of their properties,
 * they upload a document or a set of documents. These documents can
 * be saved to be reused for future leases or leases for other properties
 * they own.
 */
@ObjectType({description: "Lease Document Schema"})
export class LeaseDocument {

    @Field(() => ID)
    _id: string;

    /**
     * The name that a landlord uses to identify this lease document
     * when they want to refer to it in the future.
     */
    @Field(() => String)
    @prop({type: String})
    lease_name: string;

    /**
     * Array of documents that are associated with this lease document.
     */
    @Field(() => [S3Document])
    @prop({type: [S3Document]})
    documents: S3Document[];

    /**
     * The id for the landlord that this lease document was created on.
     * This is attached to the landlord rather than the property or ownership
     * document in case the landlord wants to reuse leases for multiple properties.
     */
    @Field(() => String)
    @prop({type: String})
    landlord_id: string;
}

@ObjectType({description: "API Response class for Lease Document"})
export class LeaseDocumentAPIResponse extends APIResult(LeaseDocument) {}

@ObjectType({description: "Multiple lease documents"})
export class MultipleLeaseDocuments {

    @Field(type => [LeaseDocument])
    @prop({type: [LeaseDocument]})
    lease_documents: LeaseDocument[];
}

@ObjectType({description: "Multiple lease documents response"})
export class MultipleLeaseDocumentsAPIResponse extends APIResult(MultipleLeaseDocuments) {}

export const LeaseDocumentModel = getModelForClass(LeaseDocument);