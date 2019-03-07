# apollo_subscription_boilerplate
This is a very simple minimum setup of a graphql server with apollo server to demonstrate how to setup subscription. 
I have searched many places about how to setup apollo server subscription. There is a complete guide for it [here].(https://blog.apollographql.com/tutorial-graphql-subscriptions-server-side-e51c32dc2951)

## What is missing from exising docs and why I made this boilerplate
But one of the most important thing that I couldn't figure out, and None of these tutorials covers, is that, when the server broadcast an event, say a "model updated" message, the graphQL subscription actually is allowed to subscribe to nested fields. Then the original broadcasted message is not the correct message to broadcast to the client. To demonstrate, suppose you have a model 
```
type message {
  id: Int!
  text: String!
  authorId: Int!
  authorByAuthorId: User!
}
type User{
  id: Int!
  name: String!
}
```
The schema is 
```
mutation{
  updateMessage(id:Int!, text:String): Message
}
subscription{
  messageUpdated(id:Int!):Message
}
```
If you subscribe with the following query
```
subscription {
   messageUpdated(id:1){
       text
       authorByAuthorId{
           name
       }
   }
}
```
Then let's say another user sent a mutation query.
```
mutation {
   updateMessage(id:1, text:"change to something else"){
     id
   }
}
```
a message is updated, the original message, is not enough to be send to client, you will need to do more query to construct the authorByAuthorId. And No tutorials have talked about it. Ok, I take it back, there is a resolver function for subscription that you could setup. But that's not well documented anywhere. So I decided to work on this my own. 

### Solution of doing pubsub after mutated a model
This boiler plate is simply a demonstration. Read the code, and understand how it was setup. The model.js was simply a js model with no database attached. The schema.js is where all the subscription/broadcast happens. 
