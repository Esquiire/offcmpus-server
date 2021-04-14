import { DocumentType } from '@typegoose/typegoose';

export class GeneratorResult<T> {

    private data: DocumentType<T>;

    constructor(data_: DocumentType<T>) {
        this.data = data_;
    }

    getData(): DocumentType<T> { return this.data; }
}