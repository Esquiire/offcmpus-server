import express from 'express'
import chalk from 'chalk'
import Student, {IStudentDoc} from '../../schemas/student.schema'
import {StudentModel, Student as StudentObj, initializeStudentSearchStatus} from '../../GQL/entities/Student'
import {InstitutionModel, Institution} from '../../GQL/entities/Institution'
import {DocumentType} from "@typegoose/typegoose"
import _, { update } from 'lodash'

const studentRouter = express.Router();

const has = (obj_: {[key: string]: any}, prop: string) => Object.prototype.hasOwnProperty.call(obj_, prop);

studentRouter.put('/students', async (req, res) => {

  // create a new student object
  let student_info = req.body;
  if (student_info == undefined) {
    res.json({success: false, error: "No body payload found"});
    return;
  }

  // ================ BEGIN VALIDATIONS ================
  if (!has(student_info, 'first_name')) {
    res.json({success: false, error: "No first name"});
    return;
  }

  if (!has(student_info, 'last_name')) {
    res.json({success: false, error: "No last name"});
    return;
  }

  if (!has(student_info, 'email')) {
    res.json({success: false, error: "No email"});
    return;
  }
  // ================ END VALIDATIONS ================

  // check if the student exists
  let new_student: DocumentType<StudentObj> | null = await StudentModel.findOne({
    '$or': [{email: student_info.email}, {student_info: student_info.preferrerd_email}]
  });

  if (new_student != null) {
    res.json({success: false, error: "Student with this email already exists."});
    return;
  }

  // see if their email is an institution edu
  let institution: DocumentType<Institution> | null = await emailToInstitution(student_info.email);
  if (institution == null) {
    res.json({success: false, error: "Not an institutional email."});
    return;
  }

  new_student = new StudentModel();
  new_student.saved_collection = [];
  new_student.user_settings = {
    recieve_email_notifications: true,
    push_subscriptions: []
  };
  new_student.auth_info = {
    institution_id: institution._id,
    auth_type: 'local'
  };
  new_student.accepted_leases = [];
  new_student.convenience_tags = [];
  new_student.conveinence_setup = false;
  initializeStudentSearchStatus(new_student);
  new_student.save();

  res.json({
    success: true
  });

});

studentRouter.put('/', (req, res) => {
  
  /*
  PUT /students -> Create a new student with data from req.body
  */

  console.log(chalk.bgBlue(`👉 PUT /api/students/`))
  let student_ = req.body

  if (student_ == undefined) {
    console.log(chalk.bgRed(`❌ Error: No student data found`))
    res.json({
      success: false,
      error: "No student data found" 
    })
    return;
  }

  if (!_.has(student_, "first_name")) {
    console.log(chalk.bgRed(`❌ No first_name field`))
    res.json({
      success: false,
      error: "Insufficient fields"
    })
    return;
  }

  if (!_.has(student_, "last_name")) {
    console.log(chalk.bgRed(`❌ No last_name field`))
    res.json({
      success: false,
      error: "Insufficient fields"
    })
    return;
  }

  if (!_.has(student_, "email")) {
    console.log(chalk.bgRed(`❌ No email field`))
    res.json({
      success: false,
      error: "Insufficient fields"
    })
    return;
  }

  Student.findOne({email: student_.email}, (err, student_doc) => {

    // if the student does not exist yet, create it.
    if (err || !student_doc) {

      let new_student = new Student({
        first_name: student_.first_name,
        last_name: student_.last_name,
        email: student_.email
      });
    
      new_student.save((err: any, new_student_doc: IStudentDoc) => {
        if (err) {
          console.log(chalk.bgRed(`❌ Problem saving student`))
          res.json({
            success: false,
            error: "Internal server error"
          })
        }
        else {
          console.log(chalk.bgGreen(`✔ Successfully created new user [first_name: ${new_student_doc.first_name}, last_name: ${new_student_doc.last_name}]`))
          res.json({
            success: true,
            _id: new_student_doc._id,
            first_name: new_student_doc.first_name,
            last_name: new_student_doc.last_name,
            email: new_student_doc.email
          })
        }
      })

    }

    // if the student already exists, return error
    else {
      console.log(chalk.bgRed(`❌ Error: student with email ${student_.email} already exists`))
      res.json({
        success: false,
        error: "Student already exists"
      })
    }
  })

})

studentRouter.put('/:id/', (req, res) => {

  /*
  Update the document information for the user with the specified id
  */
 let user_id = req.params.id
 console.log(chalk.bgBlue(`👉 PUT /api/students/:id`))

 let updated_info = req.body
 Student.findById(user_id, async (err: any, student_doc: IStudentDoc) => {
   if (err) {
     console.log(chalk.bgRed(`❌ Error occurred looking for student with id ${user_id}`))
     res.json({
       success: false,
       error: "Internal serfver error"
     })
   }

   else if (!student_doc) {
     console.log(chalk.bgRed(`❌ Error: Attempting to update info for nonexisting user`))
     res.json({
       success: false,
       error: "Invalid user id"
     })
   }

   else {
     // update the fields
     if (_.has(updated_info, "first_name")) student_doc.first_name = updated_info.first_name
     if (_.has(updated_info, "last_name")) student_doc.last_name = updated_info.last_name
     if (_.has(updated_info, "email")) student_doc.email = updated_info.email

     let updated_student_doc = await student_doc.save()

     res.json({
       success: true,
       updated_student: updated_student_doc.toObject()
     })
   }
 })

})

/**
 * @desc Given an email address, determine which institution this email is for.
 * If the institution is not within our system, return null.
 * @param email 
 */
const emailToInstitution = async (email: string): Promise<DocumentType<Institution> | null> => {

  // find the last '@'
  let ind = email.lastIndexOf('@');
  if (ind == -1) return null;

  let suffix = email.substring(ind + 1);
  let institution: DocumentType<Institution> | null = await InstitutionModel.findOne({
    edu_suffix: suffix
  });

  // institution does not exist ...
  if (institution == null) return null;

  return institution;

}

export default studentRouter