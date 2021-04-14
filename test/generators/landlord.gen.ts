import { Landlord, LandlordModel, LandlordAPIResponse } from '../../GQL/entities/Landlord';

import { apolloServerTestClient } from '../mocha_globals';
import { DocumentType } from '@typegoose/typegoose';
import faker from 'faker';
import { gql } from 'apollo-server-express';

import { GeneratorResult } from '.';

export const LandlordGenerator = async (): Promise<GeneratorResult<Landlord> | null> => {

    let new_landlord_created = false;
    let firstName = null,
        lastName = null,
        email = null,
        password = null;

    do {

        firstName = faker.name.firstName();
        lastName = faker.name.lastName();
        email = `${firstName}_${lastName}@landlord_email.test`;
        password = faker.internet.password();

        while ((email as string).indexOf(' ') != -1)
            email.replace(' ', '_');

        let landlord: DocumentType<Landlord> | null = await LandlordModel.findOne({ email });
        new_landlord_created = landlord == null;

    } while (!new_landlord_created);

    const { mutate } = apolloServerTestClient;
    let response = await mutate<{ createLandlord: LandlordAPIResponse }>({
        mutation: gql`
        mutation CreateLandlord($firstName: String!, $lastName: String!, $email: String!, $password: String!) {
            createLandlord(new_landlord:{first_name:$firstName, last_name: $lastName, email: $email, password: $password}) {
                success, error, data { first_name, last_name, email }
            }
        }
        `,
        variables: {
            firstName, lastName, email, password
        }
    });

    let landlord: DocumentType<Landlord> | null = await LandlordModel.findOne({ email });
    if (landlord == null) return null;
    return new GeneratorResult<Landlord>(landlord);
}