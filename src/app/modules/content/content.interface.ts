import { Types } from "mongoose";
import { TContent } from "./content.constant";

export interface IContent {
  _id?: Types.ObjectId;
  type: TContent;
  title: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TContentPayload {
  type: TContent;
  title: string;
  content: string;
}