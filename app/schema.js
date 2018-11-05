import { gql } from 'apollo-server-express';
import { PubSub, withFilter } from 'apollo-server';
import { Message } from './models';

const typeDefs = gql`
   type Message {
       id: Int!,
       text: String!,
       isFavorite: Boolean!
   }
   type Query {
       allMessages: [Message]
       fetchMessage(id: Int!): Message
   }
   type Mutation {
       createMessage (
           text: String!
       ): Message
       updateMessage (
           id: Int!
           text: String!
           isFavorite: Boolean!
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
        async fetchMessage(_, { id }) {
            return await Message.findById(id);
        },
    },
    Mutation: {
        async createMessage(_, { text }) {
            const message = await Message.create({ text });
            await pubsub.publish(MESSAGE_CREATED, { messageCreated: message });
            return message;
        },
        async updateMessage(_, { id, text, isFavorite}) {
            const message = await Message.findById(id);
            await message.update({text,isFavorite})
            .then(message=>{
                const allInfos = Object.values(pubsub.subscriptions).filter(([s, f]) => s === channelName).map(([s, f]) => f());
                if (allInfos.length < 1) return result;
                const allNodes = allInfos.map(i => i.fieldNodes[0]);
                const pubNode = mergeReturnNodes(allNodes);
                const newInfo = { ...allInfos[0], fieldNodes: [pubNode] };
                // Do a sql query to get the data
                newInfo.mergeInfo.delegate(
                  'query',
                  `${camelName}ById`,
                  { id },
                  context,
                  newInfo,
                ).then((pubData) => {
                  pubsub.publish(channelName, {
                    [channelName]: pubData,
                  });
                });
                pubsub.publish(MESSAGE_UPDATED, { messageUpdated: message });
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
