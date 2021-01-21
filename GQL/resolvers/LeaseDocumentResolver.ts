import {Resolver, Mutation, Arg, Query} from 'type-graphql'
import {DocumentType} from '@typegoose/typegoose'
import {Landlord, LandlordModel} from '../entities/Landlord'
import {LeaseDocument, LeaseDocumentModel,
    MultipleLeaseDocumentsAPIResponse,
    LeaseDocumentAPIResponse} from '../entities/LeaseDocument'
import mongoose, {DocumentQuery} from 'mongoose'

const ObjectId = mongoose.Types.ObjectId;

@Resolver()
export class LeaseDocumentResolver {

    @Query(returns => MultipleLeaseDocumentsAPIResponse)
    async getLeaseDocumentsForLandlord(
        @Arg("landlord_id") landlord_id: string
    ): Promise<MultipleLeaseDocumentsAPIResponse>
    {

        if (ObjectId.isValid(landlord_id)) {
            return {
                success: false,
                error: "Invalid landlord id."
            }
        }

        let lease_documents: DocumentType<LeaseDocument>[] = await LeaseDocumentModel.find({landlord_id}) as DocumentType<LeaseDocument>[];
        return {
            success: true,
            data: {
                lease_documents
            }
        }

    }

    @Mutation(returns => LeaseDocumentAPIResponse)
    async addNewLeaseDocument(
        @Arg("lease_name") lease_name: string,
        @Arg("landlord_id") landlord_id: string,
        @Arg("document_keys", type => [String]) document_keys: string[]
    ): Promise<LeaseDocumentAPIResponse> 
    {

        if (ObjectId.isValid(landlord_id)) {
            return {
                success: false,
                error: "Invalid landlord id."
            }
        }

        let newLeaseDocument: DocumentType<LeaseDocument> = new LeaseDocumentModel({
            lease_name,
            documents: document_keys,
            landlord_id
        });
        newLeaseDocument.save();

        return {
            success: true,
            data: newLeaseDocument
        };
    }

}