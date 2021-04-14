/**
 * Landlord Tests
 */
import 'mocha';
import chai from 'chai';
import faker from 'faker';

import { gql } from 'apollo-server-express';
import { apolloServerTestClient } from './mocha_globals';

import { Landlord, LandlordModel, LandlordAPIResponse } from '../GQL/entities/Landlord';
import { DocumentType } from '@typegoose/typegoose';
import { GeneratorResult } from './generators';
import { LandlordGenerator } from './generators/landlord.gen';

const { expect } = chai;

describe("createLandlord", () => {

    it("creates a new landlord that does not already exist", async () => {

        const { mutate } = apolloServerTestClient;

        // 1. Create the properties of the new landlord
        let firstName = null;
        let lastName = null;
        let email = null;
        let password = null;

        do {
            firstName = faker.name.firstName();
            lastName = faker.name.lastName();
            email = `${firstName}_${lastName}@email.com`;

            while (email.indexOf(' ') != -1) email.replace(' ', '_');
            password = faker.internet.password();

        } while (await LandlordModel.findOne({ email: email == null ? '' : email }) != null);

        // 2. Test that the current landlord does not exist
        let landlord: DocumentType<Landlord> | null = await LandlordModel.findOne({ email });
        expect(landlord).to.be.null;

        // 3. Create the landlord
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

        // 4. Test that the landlord now exists
        expect(response.data).to.not.be.undefined.and.to.not.be.not;
        expect(response.data!.createLandlord).to.not.be.undefined.and.to.not.be.null;
        expect(response.data!.createLandlord.error).to.be.null;
        expect(response.data!.createLandlord.success).to.be.true;
        expect(response.data!.createLandlord.data).to.not.be.undefined.and.to.not.be.null;

        let newLandlord: Partial<Landlord> = response.data!.createLandlord.data!;
        expect(newLandlord.first_name).to.eq(firstName);
        expect(newLandlord.last_name).to.eq(lastName);
        expect(newLandlord.email).to.eq(email);

    });

    it("fails to create a new landlord that already exists", async () => {

        // 1. create an existing landlord
        let landlordGen: GeneratorResult<Landlord> | null = null;

        do {
            landlordGen = await LandlordGenerator();
        } while (landlordGen == null);

        // 2. create a new landlord with the same credentials
        const { mutate } = apolloServerTestClient;
        let landlord: DocumentType<Landlord> = landlordGen.getData();

        let response = await mutate<{ createLandlord: LandlordAPIResponse }>({
            mutation: gql`
            mutation CreateLandlord($firstName: String!, $lastName: String!, $email: String!, $password: String!) {
                createLandlord(new_landlord:{first_name:$firstName, last_name: $lastName, email: $email, password: $password}) {
                    success, error, data { first_name, last_name, email }
                }
            }
            `,
            variables: {
                firstName: landlord.first_name,
                lastName: landlord.last_name,
                email: landlord.email,
                password: faker.internet.password()
            }
        });

        // 3. Expect an error
        expect(response.data).to.not.be.undefined.and.to.not.be.null;
        expect(response.data!.createLandlord).to.not.be.undefined.and.to.not.be.null;
        expect(response.data!.createLandlord.data).to.be.null;
        expect(response.data!.createLandlord.success).to.be.false;
        expect(response.data!.createLandlord.error).to.not.be.null.and.to.not.be.undefined;
    });

});