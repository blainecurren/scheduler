const { gql } = require('apollo-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const typeDefs = require('../schema');

describe('GraphQL Schema', () => {
  it('should be valid', () => {
    // This will throw an error if the schema is invalid
    const schema = makeExecutableSchema({ 
      typeDefs, 
      resolvers: {
        Query: {
          _empty: () => "placeholder"
        }
      } 
    });
    expect(schema).toBeDefined();
  });
});

// graphql/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};