import passport from 'passport'
import chalk from 'chalk'
// import Landlord from '../schemas/landlord.schema'
import {LandlordModel, Landlord} from '../GQL/entities/Landlord'
import {StudentModel, Student} from '../GQL/entities/Student'
import {DocumentType} from "@typegoose/typegoose"
import bcrypt from 'bcrypt'

/*
Local strategy is used for landlords who want to
log into the application.
*/
passport.use(new (require('passport-local').Strategy)(
  {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  },
  (req: any, email: string, password: string, done: Function) => {


    if (req.body.auth_type == 'landlord') {
      LandlordModel.findOne({email: email}, (err, landlord_doc: DocumentType<Landlord>) => {

        if (err) {
          console.log(chalk.bgRed(`❌ Error finding landlord`))
          console.log(err)
          return done(err)
        }
        else if (!landlord_doc) {
          console.log(chalk.bgRed(`❌ Landlord does not exist`))
          return done(null, false)
        }
        else {
          // verify password
          bcrypt.compare(password, landlord_doc.password ? landlord_doc.password : '', 
          (bcrypt_err, result: boolean) => {
  
            console.log(`Passwords match? ${result}`)
  
            if (bcrypt_err) return done(bcrypt_err)
            if (!result) return done(null, false)
            else return done(null, landlord_doc)
  
          })
        }
  
      })
    }
    else if (req.body.auth_type == 'student') {
      // TODO login as student
      StudentModel.findOne({email: email}, (err, student_doc: DocumentType<Student> | null) => {
        if (err || !student_doc) return done(null, false);
        else {
          
          bcrypt.compare(password, student_doc.password ? student_doc.password : '', (bcrypt_err, result: boolean) => {
            if (bcrypt_err) return done(bcrypt_err);
            else if (!result) done(null, false);

            else return done(null, student_doc.toObject(), {new: false});
          })
        }
      });
    }

    // do not log in.
    else done(null, false);

  }
));

import express from 'express'
const authRouter = express.Router ()
authRouter.post("/local-auth", (req, res, next) => {

  console.log(chalk.bgCyan("👉 Local Auth"))
  next()
},
passport.authenticate('local'),
(req, res) => {
  
  console.log(`User:`)
  console.log(req.user)

  res.json({
    success: true
  })

})

export default authRouter