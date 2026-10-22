export const typeDefs = /* GraphQL */ `
  enum Unit {
    PCS
    KG
    GRAM
    LITRE
    ML
    PACKET
    DOZEN
  }

  enum PaymentMode {
    CASH
    UPI
    CARD
    CREDIT
  }

  enum OrderStatus {
    COMPLETED
    CANCELLED
  }

  enum KhataType {
    CREDIT
    PAYMENT
  }

  type User {
    id: ID!
    name: String!
    email: String!
    shopName: String!
    phone: String
    address: String
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Product {
    id: ID!
    name: String!
    sku: String
    barcode: String
    category: String!
    unit: Unit!
    price: Float!
    costPrice: Float!
    stock: Float!
    lowStockThreshold: Float!
    isLowStock: Boolean!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type ProductPage {
    items: [Product!]!
    total: Int!
  }

  type Customer {
    id: ID!
    name: String!
    phone: String
    address: String
    "Outstanding khata (credit) amount owed to the shop"
    balance: Float!
    createdAt: String!
  }

  type OrderItem {
    product: Product
    productId: ID!
    name: String!
    unit: Unit
    quantity: Float!
    price: Float!
    total: Float!
  }

  type Order {
    id: ID!
    billNumber: Int!
    customer: Customer
    items: [OrderItem!]!
    subtotal: Float!
    discount: Float!
    total: Float!
    paymentMode: PaymentMode!
    status: OrderStatus!
    note: String
    createdAt: String!
  }

  type OrderPage {
    items: [Order!]!
    total: Int!
  }

  type KhataEntry {
    id: ID!
    customer: Customer!
    type: KhataType!
    amount: Float!
    order: Order
    note: String
    createdAt: String!
  }

  type DashboardStats {
    todaySales: Float!
    todayOrders: Int!
    totalProducts: Int!
    lowStockCount: Int!
    totalCreditDue: Float!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    shopName: String!
    phone: String
    address: String
  }

  input ProductInput {
    name: String!
    sku: String
    barcode: String
    category: String
    unit: Unit
    price: Float!
    costPrice: Float
    stock: Float
    lowStockThreshold: Float
  }

  input ProductUpdateInput {
    name: String
    sku: String
    barcode: String
    category: String
    unit: Unit
    price: Float
    costPrice: Float
    lowStockThreshold: Float
    isActive: Boolean
  }

  input CustomerInput {
    name: String!
    phone: String
    address: String
  }

  input CustomerUpdateInput {
    name: String
    phone: String
    address: String
  }

  input OrderItemInput {
    productId: ID!
    quantity: Float!
  }

  input OrderInput {
    items: [OrderItemInput!]!
    customerId: ID
    discount: Float
    paymentMode: PaymentMode!
    note: String
  }

  type Query {
    health: String!
    me: User

    products(search: String, category: String, lowStock: Boolean, limit: Int, offset: Int): ProductPage!
    product(id: ID!): Product
    categories: [String!]!

    customers(search: String, withDue: Boolean): [Customer!]!
    customer(id: ID!): Customer

    orders(customerId: ID, from: String, to: String, limit: Int, offset: Int): OrderPage!
    order(id: ID!): Order

    khata(customerId: ID!): [KhataEntry!]!

    dashboard: DashboardStats!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!

    createProduct(input: ProductInput!): Product!
    updateProduct(id: ID!, input: ProductUpdateInput!): Product!
    deleteProduct(id: ID!): Boolean!
    "Add (positive) or remove (negative) stock, e.g. for new purchases or wastage"
    adjustStock(id: ID!, quantity: Float!): Product!

    createCustomer(input: CustomerInput!): Customer!
    updateCustomer(id: ID!, input: CustomerUpdateInput!): Customer!

    "Create a bill. Stock is reduced; CREDIT bills are added to the customer's khata."
    createOrder(input: OrderInput!): Order!
    "Cancel a bill. Stock is restored and any khata credit is reversed."
    cancelOrder(id: ID!): Order!

    "Record money received from a customer against their khata balance"
    recordPayment(customerId: ID!, amount: Float!, note: String): Customer!
  }
`;
