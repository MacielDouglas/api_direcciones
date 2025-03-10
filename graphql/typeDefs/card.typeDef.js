const cardTypeDef = `#graphql

type Card {
    id: ID!
    street: [String]!  # Retorna todos os endereços
    usersAssigned: [Assigned]!
    number: Int
    startDate: String
    endDate: String
    group: String!
}

type Address {
    id: ID
    street: String!
    number: String!
    city: String!
    neighborhood: String!
    gps: String
    complement: String
    type: String!
    photo: String
    userId: ID!
    active: Boolean!
    confirmed: Boolean!
    group: String!
    visited: Boolean!
}

type Assigned {
    userId: String!
    date: String!
    id: ID!
}

type Query {
    card: [CardResponse]!
}

type Mutation {
    createCard(newCard: NewCardInput!): CardMutationResponse
    updateCard(updateCardInput: UpdateCardInput!): CardMutationResponse
    deleteCard(id: ID!): CardMutationResponse
    assignCard(assignCardInput: AssignCardInput!): AssignCardMutationResponse
    returnCard(returnCardInput: ReturnCardInput!): CardMutationResponse
}



 type CardResponse {
    id: ID!
    street: [Address]!  # Retorna todos os endereços
    usersAssigned: [Assigned]!
    number: Int
    startDate: String
    endDate: String
    group: String!
 }

type CardMutationResponse {
    success: Boolean!
    message: String!
    card: Card
}
type AssignCardMutationResponse {
    success: Boolean!
    message: String!
    card: [Card]
}


input NewCardInput {
    street: [String]!  # Referência aos endereços
}

input UpdateCardInput {
    id: ID!
    street: [String]
}

input AssignedInput {
    userId: String!
    date: String!
}

input ReturnCardInput {
    userId: ID!
    cardId: ID!
}

input AssignCardInput {
    cardIds: [ID]!
    userId: ID!
}
`;

export default cardTypeDef;
