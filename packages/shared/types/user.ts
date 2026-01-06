export interface User {
  _id: string;
  _creationTime: number;
  email: string;
  name: string;
  calPolyVerified: boolean;
  createdAt: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
}
