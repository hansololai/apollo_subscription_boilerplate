const store = {
    message:[],
    users:[]

};

class Message {
    constructor(data){
        this.id = data.id;
        this.text = data.text;
        this.isFavorite = false || data.isFavorite;
        this.userId = data.userId;
        this.update = this.update.bind(this);
    }
    update(data){
        this.text = data.text;
        this.isFavorite = data.isFavorite || this.isFavorite;
        this.userId = data.userId || data.userId;
        return Promise.resolve({
            id:this.id,
            text:this.text,
            isFavorite:this.isFavorite,
            userId:this.userId,
        })
    }
}
Message.all = ()=>{
        return store.message;
}
Message.findById = (id)=>{
    return store.message.find(m=>m.id === id);
}
Message.create = (data)=>{
    const allIds = store.message.map(m=>m.id);
    const maxId  = allIds.reduce((all,cur)=>Math.max(all,cur),0);
    const newMessage = new Message({isFavorite:false,...data, id: maxId +1});
    
    store.message.push(newMessage);
    return newMessage;
}

class User {
    constructor(data){
        this.id = data.id;
        this.name = data.name;
    }
    update(data){
        this.name = data.name;
        return Promise.resolve({
            id:this.id,
            name:this.name
        });
    }
}
User.all = ()=>{
    return store.users;
}
User.findById = (id)=>{
    return store.users.find(m=>m.id === id);
}
User.create = (data)=>{
    const allIds = store.users.map(m=>m.id);
    const maxId  = allIds.reduce((all,cur)=>Math.max(all,cur),0);
    const newUser = new User({...data, id: maxId +1});
    
    store.users.push(newUser);
    return newUser;
}

User.create({name:"user1"});
User.create({name:"user2"})
Message.create({text:"test message with user 1",userId:1,isFavorite:false});
export {Message, User};