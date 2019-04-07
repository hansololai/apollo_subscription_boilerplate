# apollo_subscription_boilerplate

[![Greenkeeper badge](https://badges.greenkeeper.io/hansololai/apollo_subscription_boilerplate.svg)](https://greenkeeper.io/)

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

#### Subscription function needs to save the clients
1. in the subscribe function, you will need to save the information about this subscription. More specifically, the "info" in graphql resolvers. If you are not familiar with the parent, args, context, info structure, check [here](https://www.apollographql.com/docs/graphql-tools/resolvers.html). The info object basically says a lot about the request, the operation, the document, the schema, the fields that needs to send, etc. This needs to be saved some where, then when you need to broadcast, use that object to know what to send to client. Also, in the subscribe function, you will also need to remember to remove that info object when client unsubscribes. This is done in my code [here](https://github.com/hansololai/apollo_subscription_boilerplate/blob/500ae7a0300208dff0c369740166ab08ce50e2d1/app/schema.js#L147).

#### When pubsub doing the broadcast, it will need to delegate to schema. 
2. When a message (or any model) is updated, you will then need to grab the info object that you saved from other subscription clients. Note you are in a mutation resolver, so the "current user" is the person made the mutation, and you will need to disregard the info he provided, because that's what he asks, you need to get the info of the subscription clients, and construct new objects to send to each client. But if there are so many clients, you don't want to spend a trip to database and fetch object for each client, instead you want to grab the "union" of fields that every client subscribed, and then send the data to all of them. This way you only trip to database once. This is done by construct a "fake" query and use delegate to schema. In my code it is done [here](https://github.com/hansololai/apollo_subscription_boilerplate/blob/500ae7a0300208dff0c369740166ab08ce50e2d1/app/schema.js#L112)

### DEMO
This package have a message with id=1 and user id=1 created in the store already. 
After you do 
``` yarn install & yarn start ```
You can access the playground my localhost:4000

Then you can run subscription query and mutation queries in the playground. 
For example, run a subscription query
```
subscription{
  messageUpdated(id:1){
    id
    userByUserId{
      id
      name
    }
  }
}
```
Then run another mutation query in another tab
```
# Write your query or mutation here
mutation{
  updateMessage(id:1,text:"test2",userId:2,isFavorite:true){
    id
    userId
    text
  }
}
```
Then switch to another tab, you can see the subscription was updated. Now update the same message to a different userId. 
```
# Write your query or mutation here
mutation{
  updateMessage(id:1,text:"test2",userId:1,isFavorite:true){
    id
    userId
    text
  }
}
```
Then you can see the subscription also returns different userByUserId
