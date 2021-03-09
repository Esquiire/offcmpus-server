import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import faker from "faker";

import { ObjectID } from "mongodb";
import mongoose from 'mongoose';
import bcrypt from "bcrypt";

// defaults
const DEFAULT_OUT_DIRECTORY = ".";
const DEFAULT_OUT_STUDENTS_FILE = "students.json";
const DEFAULT_OUT_LANDLORDS_FILE = "landlords.json";
const DEFAULT_OUT_PROPERTIES_FILE = "properties.json";
const DEFAULT_OUT_STUDENT_REVIEWS = "reviews.json";
const DEFAULT_NUM_STUDENTS = 200;
const DEFAULT_NUM_LANDLORDS = 15;
const DEFAULT_NUM_PROPERTIES = 40;
const DEFAULT_NUM_STUDENT_REVIEWS = 50;
const DEFAULT_SEED = 1;

// helper models
import {Student as _Student_} from '../GQL/entities/Student'
import {Landlord as _Landlord_} from '../GQL/entities/Landlord'
import {Property as _Property_} from '../GQL/entities/Property'

type MongoObjectID = {
  $oid: ObjectID;
};
type Student = Omit<_Student_, "_id"> & {
  _id: MongoObjectID;
};

type Property = Omit<_Property_, "_id" | "landlord"> & {
  _id:MongoObjectID
  landlord: MongoObjectID
}

type Landlord = Omit<_Landlord_, "_id"> & {
  _id: MongoObjectID
}

class OIDFactory {
  static id_memory: {[key: string]: mongoose.Types.ObjectId[]} = {};

  /**
   * Generate an object id that is unique to the collection_name
   * @param collection_name: string => The collection_name to instantiate the
   * ObjectId within.
   */
  static generateObjectID (collection_name: string): mongoose.Types.ObjectId {
    if (!Object.prototype.hasOwnProperty.call(this.id_memory, collection_name)) this.id_memory[collection_name] = []
    let oid: mongoose.Types.ObjectId;
    do {
      oid = mongoose.Types.ObjectId();
    } while (this.id_memory[collection_name].includes( oid ))
    this.id_memory[collection_name].push(oid)
    return oid;
  }
}

const objectFactory = <T>(n: number, generator: () => T) => {
  const objects: T[] = [];
  for (let i = 0; i < n; i++) {
    objects.push(generator());
  }
  return objects;
};

/**
 * generateStudent
 * @desc Create a new student object with mock data
 */
const generateStudent = (): Student => {
  let _fname: string = faker.name.firstName();
  let _lname: string = faker.name.lastName();
  let mock_student: Student = {
    accepted_leases: [],
    _id: {$oid: OIDFactory.generateObjectID('student')},
    first_name: _fname,
    last_name: _lname,
    email:`/\\fake_offcmpus_email@+${faker.internet.email(_fname, _lname)}`,
    phone_number: faker.phone.phoneNumber("+1##########"),
    saved_collection: [],
    user_settings: {
      recieve_email_notifications: false,
      push_subscriptions: []
    },
    auth_info: {
      auth_type: 'local',
      institution_id: '',
      cas_id: `${_fname.replace(' ', '_')}_${_lname.replace(' ', '_')}`
    },
    conveinence_setup: false,
    convenience_tags: []
  }
  return mock_student;
}
const generateStudents = (n: number) => objectFactory(n, generateStudent);

/**
 * generateProperty
 * @desc Create a new property object with mock data
 */
const generateProperty = (): Property => {
  return {
    _id: {$oid: OIDFactory.generateObjectID('property')},
    landlord: {$oid: OIDFactory.generateObjectID('landlord')},
    address_line: faker.address.streetAddress(),
    city: faker.address.city(),
    state: faker.address.stateAbbr(),
    zip: faker.address.zipCode()
  }
}
const generateProperties = (n: number) => objectFactory(n, generateProperty)

/**
 * generateLandlord
 * @desc Create a new ladlord object with mock data
 */
const generateLandlord = (): Landlord => {
  let _fname: string = faker.name.firstName();
  let _lname: string = faker.name.lastName();
  return {
    _id: {$oid: OIDFactory.generateObjectID('landlord')},
    first_name: _fname,
    last_name: _lname,
    email: `/\\fake_offcmpus_email@+${faker.internet.email(_fname, _lname)}`,
    phone_number: faker.phone.phoneNumber("+1##########"),
    password: bcrypt.hashSync(faker.internet.password(), 1),
    user_settings: {
      recieve_email_notifications: false,
      push_subscriptions: []
    }
  }
}
const gnerateLandlords = (n: number) => objectFactory(n, generateLandlord)

/////////////////////////////////////////////////////////

type GenerateDataProps = {
  numStudents: number;
  numProperties: number;
} & Partial<SeedProps>;
const generateData = ({
  seed,
  numStudents,
  numProperties
}: GenerateDataProps) => {
  if (seed !== undefined) {
    seedGenerator({ seed });
  }

  const students = generateStudents(numStudents);
  const properties = generateProperties(numProperties);

  return {
    students,
    properties
  };
};

interface SeedProps {
  seed: number;
}
const seedGenerator = ({ seed }: SeedProps) => {
  faker.seed(seed);
};
seedGenerator({ seed: DEFAULT_SEED });

const writeFileAsync = promisify(fs.writeFile);
type WriteDataProps = {
  directory?: string;
} & GenerateDataProps;
const writeData = async (props?: WriteDataProps & Partial<SeedProps>) => {
  const { seed, directory, ...generateDataProps } = props ?? {};

  if (seed !== undefined) {
    seedGenerator({ seed });
  }

  const directoryPath = path.resolve(
    __dirname,
    directory ?? DEFAULT_OUT_DIRECTORY
  );

  const { students, properties } = generateData({
    numStudents: DEFAULT_NUM_STUDENTS,
    numProperties: DEFAULT_NUM_PROPERTIES,
    ...generateDataProps,
  });

  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath);
  }

  return Promise.all([
    writeFileAsync(
      path.resolve(directoryPath, DEFAULT_OUT_STUDENTS_FILE),
      JSON.stringify(students)
    ),
    writeFileAsync(
      path.resolve(directoryPath, DEFAULT_OUT_PROPERTIES_FILE),
      JSON.stringify(properties)
    )
  ]);
};

export {
  Student,
  Property,
  Landlord,
  writeData
}
