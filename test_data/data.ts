import * as fs from "fs";

import { Student as _Student_, Property as _Property_, /*StudentReview,*/ Landlord as _Landlord_ } from "./seed";
import {Student} from '../GQL/entities/Student'
import {Property} from '../GQL/entities/Property'
import {Landlord} from '../GQL/entities/Landlord'
import { exit } from "process";

const rawLandlords: _Landlord_[] = require("../test_data/landlords.json");
const rawProperties: _Property_[] = require("./properties.json");
// const rawReviews: StudentReview[] = require("../test_data/reviews.json");
const rawStudents: _Student_[] = require("./students.json");

const convertOidToStr = (oid: any): string => oid.$oid;


const landlords: Landlord[] = rawLandlords.map((landlord: _Landlord_) => ({
  ...landlord,
  _id: convertOidToStr(landlord._id),
}));

const properties: Property[] = rawProperties.map((property: _Property_) => ({
  ...property,
  _id: convertOidToStr(property._id),
  landlord: convertOidToStr(property.landlord)
}));

/*
const reviews: IReview[] = rawReviews.map((review) => ({
  ...review,
  _id: convertOidToStr(review._id),
  student_id: convertOidToStr(review.student_id),
  property_id: convertOidToStr(review.property_id),
  landlord_id: convertOidToStr(review.landlord_id),
}));*/

const students: Student[] = rawStudents.map((student: _Student_) => ({
  ...student,
  _id: convertOidToStr(student._id),
}));

/**
 * @desc Return a random document from the generated set.
 * If there are criterias passed for the data, the returned document
 * must meet all the criterias
 * @param param0 
 */
const randomSample = <T>({
  of, criterias
}:{
  of: T[], criterias?: ((obj: T) => boolean)[]
}): T => {
  if (of.length == 0) {
    console.error(`randomSample:: collection is empty.`);
    exit(0);
  }
  if (criterias == undefined) return of[ Math.floor(Math.random() * of.length) ];
  else {
    let data: T;

    do {
      data = of[ Math.floor(Math.random() * of.length) ];
    } while( !meetsCriterias(data, criterias) );
  }
}

const meetsCriterias = <T>(data: T, criterias: ((obj: T) => boolean)[]) => {
  for (let i = 0; i < criterias.length; ++i) {
    if (!criterias[i](data)) return false;
  }
  return true;
}

export { landlords, /*reviews,*/ properties, students, randomSample};
