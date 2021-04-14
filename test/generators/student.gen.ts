
import { Student, StudentModel, StudentAPIResponse } from '../../GQL/entities/Student'

import { apolloServerTestClient } from '../mocha_globals';
import { DocumentType } from '@typegoose/typegoose';
import faker from 'faker';
import { gql } from 'apollo-server-express';

import { GeneratorResult } from '.';

export const StudentGenerator = async (): Promise<GeneratorResult<Student> | null> => {

    let new_student_found = false;
    let firstName = null;
    let lastName = null;
    let email = null;

    do {

        firstName = faker.name.firstName();
        lastName = faker.name.lastName();
        email = `${firstName}_${lastName}@rpi.edu`;
        while (email.indexOf(' ') != -1) email = email.replace(' ', '_');

        let student_: DocumentType<Student> | null = await StudentModel.findOne({ edu_email: email });
        new_student_found = student_ == null;

    } while (!new_student_found);


    const { mutate } = apolloServerTestClient;
    let response = await mutate<{ createStudent: StudentAPIResponse }>({
        mutation: gql`
        mutation CreateStudent($fName: String!, $lName: String!, $email: String!, $password: String!){
            createStudent(first_name:$fName, last_name: $lName, email: $email, password: $password) {
                success, error
            }
        }`,
        variables: { fName: firstName, lName: lastName, email, password: faker.internet.password() }
    });

    let student: DocumentType<Student> | null = await StudentModel.findOne({ edu_email: email });
    if (student == null) return null;
    return new GeneratorResult<Student>(student);
};

export const setSearchStatus = async (studentGen: GeneratorResult<Student>,
    { searching, search_start, search_end, price_start, price_end }:
        { searching: boolean, search_start?: string, search_end?: string, price_start?: number, price_end?: number }): Promise<GeneratorResult<Student>> => {

    const { mutate } = apolloServerTestClient;
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
            id: studentGen.getData()._id.toString(), searching, search_start, search_end, price_start, price_end
        }
    });

    // fetch the updated data
    let student: DocumentType<Student> | null = await StudentModel.findById(studentGen.getData()._id.toString());
    if (student == null) {
        console.error(`[setSearchStatus] student w/ id ${studentGen.getData()._id.toString()} could not be found.`);
        return studentGen;
    }

    return new GeneratorResult<Student>(student);
}