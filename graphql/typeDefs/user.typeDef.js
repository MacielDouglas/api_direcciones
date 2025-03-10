const userTypeDef = `#graphql

type Comment {
    cardId: ID!
    text: String!
}

type Address {
    id: ID!
    street: String!
    number: String!
    neighborhood: String
    city: String!
    gps: String
    complement: String
    userId: ID!
    type: String!
    photo: String
    confirmed: Boolean!
    active: Boolean!
    visited: Boolean
}

type User {
    id: ID!
    name: String!
    email: String!
    password: String!
    profilePicture: String!
    isAdmin: Boolean!
    group: String!
    isSS: Boolean!
    isSCards: Boolean!
    idToken: String
    codUser: Int!
}

type UserSummary {
    id: ID!
    name: String!
    group: String
    codUser: Int
    profilePicture: String
}

type Query {
    getUsers: [UserSummary]
    user(id: ID, email: String): UserResponse
    logout: UserResponse
}

type Mutation {
    loginWithGoogle(user: UserGoogle!): UserResponse!
    deleteUser(id: ID!): UserMutationResponse!
    updateUser(id: ID!, user: UpdateUserInput!): UserMutationResponse!
}

type UserResponse {
    user: User
    success: Boolean!
    message: String
}

type UserMutationResponse {
    success: Boolean!
    message: String
    user: User
}

input UserGoogle {
    displayName: String!
    email: String!
    photoUrl: String!
    uid: String!
}

input UpdateUserInput {
    name: String
    email: String
    profilePicture: String
    isAdmin: Boolean
    group: String
    isSS: Boolean
    isSCards: Boolean
}

type LoginGoogleResponse {
    success: Boolean!
    message: String!
    name: String!
    photoUrl: String
}
`;
export default userTypeDef;
