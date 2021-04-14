/**
 * Student Tests
 */
import 'mocha';
import chai from 'chai';
import faker from 'faker';

import { gql } from 'apollo-server-express';
import { apolloServerTestClient } from './mocha_globals';

import { Student, StudentModel, SearchStatus, StudentAPIResponse } from '../GQL/entities/Student'
import { DocumentType } from '@typegoose/typegoose';

import { GeneratorResult } from './generators';
import { StudentGenerator, setSearchStatus } from './generators/student.gen';

const { expect } = chai;

describe("createStudent", () => {

    it("creates a new student", async () => {

        const { mutate } = apolloServerTestClient;

        // create a new student
        let firstName = null;
        let lastName = null;
        let email = null;
        let password = null;

        let new_user_found = false;

        // find a new user that does not
        // already exist
        do {
            firstName = faker.name.findName();
            lastName = faker.name.lastName();

            email = `${firstName}_${lastName}@rpi.edu`;
            while (email.indexOf(' ') != -1) email = email.replace(' ', '_');

            password = faker.internet.password();

            // check if they exist
            let student: DocumentType<Student> | null = await StudentModel.findOne({ edu_email: email });
            new_user_found = student == null;

        } while (!new_user_found);

        expect(firstName).to.not.be.null;
        expect(lastName).to.not.be.null;
        expect(email).to.not.be.null;
        expect(password).to.not.be.null;

        // execute the createStudent query
        let response = await mutate<{ createStudent: StudentAPIResponse }>({
            mutation: gql`
            mutation CreateStudent($fName: String!, $lName: String!, $email: String!, $password: String!){
                createStudent(first_name:$fName, last_name: $lName, email: $email, password: $password) {
                    success, error
                }
            }`,
            variables: { fName: firstName, lName: lastName, email, password }
        });

        // check that the response is not null
        expect(response.data).to.not.be.undefined;
        expect(response.data!.createStudent).to.not.be.undefined;
        expect(response.data!.createStudent.error).to.be.null;
        expect(response.data!.createStudent.success).to.be.true;

        // the student created is not returned
        let newStudent: DocumentType<Student> | null = await StudentModel.findOne({ edu_email: email });
        expect(newStudent).to.not.be.null;
        expect(newStudent).to.not.be.undefined;
        expect(newStudent!.first_name).to.eq(firstName);
        expect(newStudent!.last_name).to.eq(lastName);

    });

    it("should fail to create a student that already exists", async () => {

        // pre-test requiement: a student already exists in the system
        let result: GeneratorResult<Student> | null = null;

        do {
            result = await StudentGenerator();
        } while (result == null);

        const { mutate } = apolloServerTestClient;
        let student: DocumentType<Student> = result.getData();

        let response = await mutate<{ createStudent: StudentAPIResponse }>({
            mutation: gql`
            mutation CreateStudent($fName: String!, $lName: String!, $email: String!, $password: String!){
                createStudent(first_name:$fName, last_name: $lName, email: $email, password: $password) {
                    success, error
                }
            }`,
            variables: { fName: student.first_name, lName: student.last_name, email: student.email, password: student.password }
        });

        expect(response.data).to.not.be.undefined;
        expect(response.data!.createStudent).to.not.be.undefined;
        expect(response.data!.createStudent.error).to.not.be.null;
        expect(response.data!.createStudent.error).to.not.be.undefined;
        expect(response.data!.createStudent.success).to.be.false;
    });

});

describe("updateStudentSearchStatus", () => {

    it("updates the student's search status to a searching state, from default state (not-searching)", async () => {

        const { mutate } = apolloServerTestClient;
        let result: GeneratorResult<Student> | null = null;

        // get a new student instance
        do {
            result = await StudentGenerator();
        } while (result == null);

        /** 
         * Pre-Assertion:
         * - Student's search status should be set to false
        */
        let student: DocumentType<Student> = result.getData();
        expect(student.search_status).to.not.be.null;
        expect(student.search_status).to.not.be.undefined;
        expect(student.search_status!.searching).to.be.false;

        /** 
         * Update the student's search status 
        */

        // Start Date: 1 month in future
        let start = new Date();
        start.setMonth(start.getMonth() + 1);

        // End Date: 2 months in the future
        let end = new Date();
        end.setMonth(end.getMonth() + 2);

        let price_range = { start: 100, end: 400 };

        let response = await mutate<{ updateStudentSearchStatus: StudentAPIResponse }>({
            mutation: gql`
            mutation UpdateStudentSearchStatus($id: String!, $searching: Boolean!, $search_start: String, 
                $search_end: String, $price_start: Float, $price_end: Float) {
                updateStudentSearchStatus (id:$id, searching: $searching, search_start: $search_start, search_end: $search_end,
                price_start: $price_start, price_end: $price_end) {
                    success, error, data {
                        search_status {
                            searching, search_start, search_end, price_start, price_end
                        }
                    }
                }
            }
            `,
            variables: {
                id: student._id.toString(), searching: true, search_start: start.toISOString(), search_end: end.toISOString(),
                price_start: price_range.start, price_end: price_range.end
            }
        });

        expect(response).to.not.be.null.and.to.not.be.undefined;
        expect(response.data).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus.error).to.be.null;
        expect(response.data!.updateStudentSearchStatus.success).to.be.true;
        expect(response.data!.updateStudentSearchStatus.data).to.not.be.undefined.and.to.not.be.null;

        let searchStatus: Partial<SearchStatus> | undefined = response.data!.updateStudentSearchStatus.data!.search_status;
        expect(searchStatus).to.not.be.null.and.to.not.be.undefined;
        expect(searchStatus!.searching).to.be.true;
        expect(searchStatus!.price_start).to.eq(price_range.start);
        expect(searchStatus!.price_end).to.eq(price_range.end);
        expect(searchStatus!.search_start).to.eq(start.toISOString());
        expect(searchStatus!.search_end).to.eq(end.toISOString());

    });

    it("should clear the search status of a student with an existing search status", async () => {

        const { mutate } = apolloServerTestClient;
        let result: GeneratorResult<Student> | null = null;

        // get a new student instance
        do {
            result = await StudentGenerator();
        } while (result == null);

        let start = new Date();
        start.setMonth(start.getMonth() + 1);

        let end = new Date();
        end.setMonth(end.getMonth() + 1);

        let price_range = { start: 400, end: 500 };

        // set the search status
        result = await setSearchStatus(result, {
            search_start: start.toISOString(),
            search_end: end.toISOString(),
            searching: true,
            price_start: price_range.start,
            price_end: price_range.end
        });

        let student: DocumentType<Student> = result.getData();

        expect(student.search_status).to.not.be.undefined.and.to.not.be.null;
        expect(student.search_status!.searching).to.be.true;
        expect(student.search_status!.search_start).to.eq(start.toISOString());
        expect(student.search_status!.search_end).to.eq(end.toISOString());
        expect(student.search_status!.price_start).to.eq(price_range.start);
        expect(student.search_status!.price_end).to.eq(price_range.end);

        // clear the search status
        let response = await mutate<{ updateStudentSearchStatus: StudentAPIResponse }>({
            mutation: gql`
            mutation UpdateStudentSearchStatus($id: String!, $searching: Boolean!, $search_start: String, 
                $search_end: String, $price_start: Float, $price_end: Float) {
                updateStudentSearchStatus (id:$id, searching: $searching, search_start: $search_start, search_end: $search_end,
                price_start: $price_start, price_end: $price_end) {
                    success, error, data {
                        search_status {
                            searching, search_start, search_end, price_start, price_end
                        }
                    }
                }
            }
            `,
            variables: {
                id: student._id.toString(), searching: false
            }
        });


        expect(response).to.not.be.null.and.to.not.be.undefined;
        expect(response.data).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus.error).to.be.null;
        expect(response.data!.updateStudentSearchStatus.success).to.be.true;
        expect(response.data!.updateStudentSearchStatus.data).to.not.be.undefined.and.to.not.be.null;

        let searchStatus: Partial<SearchStatus> | undefined = response.data!.updateStudentSearchStatus.data!.search_status;
        expect(searchStatus!.searching).to.be.false;
        expect(searchStatus!.price_end).to.be.null;
        expect(searchStatus!.price_start).to.be.null;
        expect(searchStatus!.search_start).to.be.null;
        expect(searchStatus!.search_end).to.be.null;

    });

    it("should fail to add a search status for a start_date in the past", async () => {

        const { mutate } = apolloServerTestClient;
        let result: GeneratorResult<Student> | null = null;

        // get a new student instance
        do {
            result = await StudentGenerator();
        } while (result == null);

        /** 
         * Pre-Assertion:
         * - Student's search status should be set to false
        */
        let student: DocumentType<Student> = result.getData();
        expect(student.search_status).to.not.be.null;
        expect(student.search_status).to.not.be.undefined;
        expect(student.search_status!.searching).to.be.false;

        /** 
         * Update the student's search status 
        */

        // Start Date: 1 month in past
        let start = new Date();
        start.setMonth(start.getMonth() - 1);

        // End Date: 1 months in the future
        let end = new Date();
        end.setMonth(end.getMonth() + 1);

        let price_range = { start: 100, end: 400 };

        let response = await mutate<{ updateStudentSearchStatus: StudentAPIResponse }>({
            mutation: gql`
            mutation UpdateStudentSearchStatus($id: String!, $searching: Boolean!, $search_start: String, 
                $search_end: String, $price_start: Float, $price_end: Float) {
                updateStudentSearchStatus (id:$id, searching: $searching, search_start: $search_start, search_end: $search_end,
                price_start: $price_start, price_end: $price_end) {
                    success, error, data {
                        search_status {
                            searching, search_start, search_end, price_start, price_end
                        }
                    }
                }
            }
            `,
            variables: {
                id: student._id.toString(), searching: true, search_start: start.toISOString(), search_end: end.toISOString(),
                price_start: price_range.start, price_end: price_range.end
            }
        });

        // ! This query should fail and return an error b/c the start time is in the past.
        expect(response).to.not.be.null.and.to.not.be.undefined;
        expect(response.data).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus.error).to.be.not.null;
        expect(response.data!.updateStudentSearchStatus.success).to.be.false;
        expect(response.data!.updateStudentSearchStatus.data).to.be.null;
    });

    it("should fail to add a search startus for a end_date that occurs before a start_date", async () => {


        const { mutate } = apolloServerTestClient;
        let result: GeneratorResult<Student> | null = null;

        // get a new student instance
        do {
            result = await StudentGenerator();
        } while (result == null);

        /** 
         * Pre-Assertion:
         * - Student's search status should be set to false
        */
        let student: DocumentType<Student> = result.getData();
        expect(student.search_status).to.not.be.null;
        expect(student.search_status).to.not.be.undefined;
        expect(student.search_status!.searching).to.be.false;

        /** 
         * Update the student's search status 
        */

        // Start Date: 2 months in the future
        let start = new Date();
        start.setMonth(start.getMonth() + 2);

        // End Date: 1 months in the future
        let end = new Date();
        end.setMonth(end.getMonth() + 1);

        let price_range = { start: 100, end: 400 };

        let response = await mutate<{ updateStudentSearchStatus: StudentAPIResponse }>({
            mutation: gql`
            mutation UpdateStudentSearchStatus($id: String!, $searching: Boolean!, $search_start: String, 
                $search_end: String, $price_start: Float, $price_end: Float) {
                updateStudentSearchStatus (id:$id, searching: $searching, search_start: $search_start, search_end: $search_end,
                price_start: $price_start, price_end: $price_end) {
                    success, error, data {
                        search_status {
                            searching, search_start, search_end, price_start, price_end
                        }
                    }
                }
            }
            `,
            variables: {
                id: student._id.toString(), searching: true, search_start: start.toISOString(), search_end: end.toISOString(),
                price_start: price_range.start, price_end: price_range.end
            }
        });

        // ! This query should fail and return an error b/c the start time is in the past.
        expect(response).to.not.be.null.and.to.not.be.undefined;
        expect(response.data).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus).to.not.be.null.and.to.not.be.undefined;
        expect(response.data!.updateStudentSearchStatus.error).to.be.not.null;
        expect(response.data!.updateStudentSearchStatus.success).to.be.false;
        expect(response.data!.updateStudentSearchStatus.data).to.be.null;
    });

});