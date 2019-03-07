import { gql } from 'apollo-server-express';
import { PubSub, withFilter } from 'apollo-server';
import { Message, User } from './models';
import {delegateToSchema} from 'graphql-tools';

/*************************** Utility function ***************/
/**
 * @description Handles the Nodes of the query Node. The query is converted to an AST. Sometimes
 * multiple queries to the same field can be merged to one to save trips to database. This function
 * merges multiple query nodes into one (union) version of all requests and make one call to database.
 * This is especially useful when broadcasting in pugsub
 * @param {*} returnNodes
 */
const mergeReturnNodes = (returnNodes) => {
    const setOfFields = {};
    returnNodes.forEach((node) => {
      const { selectionSet: { selections } } = node;
      selections.forEach((selection) => {
        const { name: { value }, selectionSet } = selection;
        if (setOfFields[value]) {
          // This field is already in the output, merge it if necessary
          if (selectionSet) {
            setOfFields[value] = mergeReturnNodes([setOfFields[value], selection]);
          } // Otherwise, leave it.
        } else {
          // This field is not in the output, put it in
          setOfFields[value] = selection;
        }
      });
    });
    // Convert setOfFields to a fieldNode
    const template = returnNodes[0];
    const { selectionSet } = template;
    const newSelectionSet = { ...selectionSet, selections: Object.values(setOfFields) };
    return { ...template, selectionSet: newSelectionSet };
  };
/*************** put it here to just save space ******************/
const typeDefs = gql`
   type Message {
       id: Int!,
       text: String!,
       isFavorite: Boolean!
       userId: Int!
       userByUserId: User!
   }
   type User {
       id: Int!,
       name: String!
   }
   type Query {
       allMessages: [Message]
       fetchMessage(id: Int!): Message
       allUsers:[User]
   }
   type Mutation {
       createMessage (
           text: String!
       ): Message
       updateMessage (
           id: Int!
           text: String!
           isFavorite: Boolean!
           userId: Int
       ): Message
   },
   type Subscription {
       messageCreated: Message
       messageUpdated(id: Int!): Message
   }
`;
require('dotenv').config();

const MESSAGE_CREATED = 'MESSAGE_CREATED';
const MESSAGE_UPDATED = 'MESSAGE_UPDATED';

const pubsub = new PubSub();

const resolvers = {
    Query: {
        async allMessages() {
            return await Message.all();
        },
        async allUsers(){
            return await User.all();
        },
        async fetchMessage(_, { id }) {
            return await Message.findById(id);
        },
    },
    Message:{
        async userByUserId(parent, args, context, info){
            // Note there's a problem here, if the user did not ask for userId, then the parent do not
            // have  userId. Of course for a full stack graphQL server, this problem would have already been solved. 
            // Let's assume it is solve, after all, this is just to demonstrate subscription
            return await User.findById(parent.userId);
        }
    },
    Mutation: {
        async createMessage(_, { text,userId }) {
            const message = await Message.create({ text, userId });
            await pubsub.publish(MESSAGE_CREATED, { messageCreated: message });
            return message;
        },
        async updateMessage(_, { id, text, isFavorite, userId}, context, info) {
            const message = await Message.findById(id);
            await message.update({text,isFavorite, userId})
            .then(message=>{
                // This block is to handle subscription. the allInfos are all the clients that's subscribed  to this channel
                // It could be thousands of people. Some of them  may request the nested user, some of them don't. Here I do something tricky
                // I merge all their request AST, generate a "union" of all the fields, and call a delegate to schema, meaning query with message
                // This is done by the mergeReturnNodes function
                const allInfos = Object.values(pubsub.subscriptions).filter(([s, f]) => s === MESSAGE_UPDATED).map(([s, f]) => f());
                if (allInfos.length < 1) return message;
                const allNodes = allInfos.map(i => i.fieldNodes[0]);
                const pubNode = mergeReturnNodes(allNodes);
                // Then I construct a new info object, which store the AST of the fields.
                const newInfo = { ...allInfos[0], fieldNodes: [pubNode] };
                // Do whatever to get the data. It could be constructed query, or just delegate to schema
                // 
                console.log(pubNode);
                delegateToSchema({
                    schema:info.schema,
                    operation:'query',
                    fieldName:'fetchMessage',
                    args: {id},
                    context,
                    info: newInfo 
                }).then(pubData=>{
                  // The pubData here should be the union of all fields subscribed by every body. 
                  // So even if many people subscribe to it, we only need to fetch once. 
                  // Then publish the data to clients
                  pubsub.publish(MESSAGE_UPDATED, {
                    messageUpdated: pubData,
                  });
                })
            });
            return message;
        },
    },
    Subscription: {
        messageCreated: {
          subscribe: () => pubsub.asyncIterator([MESSAGE_CREATED]),
        },
        messageUpdated: {
            subscribe: async (_,args,context,info)=>{
                // a subscribe function needs to 
                const iterator = withFilter(
                () => pubsub.asyncIterator('MESSAGE_UPDATED'),
                    (payload, variables) => {
                            return payload.messageUpdated.id === variables.id;
                        },
                )(_,args,context,info);
                const subId = await pubsub.subscribe('MESSAGE_UPDATED',()=>info)
                const returnFunc = iterator.return;
                iterator.return = ()=>{
                    pubsub.unsubscribe(subId);
                    return returnFunc();
                }
                return iterator;
            }
        },
    }
}
export {typeDefs, resolvers};
