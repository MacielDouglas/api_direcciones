const addressTypeDef = `#graphql

  type Address {
    id: ID!
    street: String!
    number: String!
    city: String!
    neighborhood: String!
    gps: String
    complement: String
    type: String!
    photo: String
    userId: ID!
    active: Boolean
    confirmed: Boolean!
    group: String!
    visited: Boolean!
    createdAt: String
    updatedAt: String
  }

  type AddressResponse {
    success: Boolean!
    message: String!
    address: Address
  }

  type AddressListResponse {
    success: Boolean!
    message: String!
    addresses: [Address]!
  }

  type Query {
    addresses: AddressListResponse!
  }

  input AddressInput {
    street: String!
    number: String!
    city: String!
    neighborhood: String!
    gps: String
    complement: String
    type: String!
    photo: String
    active: Boolean
    confirmed: Boolean!
    visited: Boolean!
  }

  input UpdateAddressInput {
    id: ID!
    street: String
    number: String
    city: String
    neighborhood: String
    gps: String
    complement: String
    type: String
    photo: String
    active: Boolean
    confirmed: Boolean
    group: String
    visited: Boolean
  }

  type Mutation {
    createAddress(newAddressInput: AddressInput!): AddressResponse!
    updateAddress(input: UpdateAddressInput!): AddressResponse!
    deleteAddress(id: ID!): AddressResponse!
  }
`;

export default addressTypeDef;
