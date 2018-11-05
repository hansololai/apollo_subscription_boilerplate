const store = {
    message:[]
};

class Message {
    constructor(data){
        this.id = data.id;
        this.text = data.text;
        this.isFavorite = false || data.isFavorite;
        this.update = this.update.bind(this);
    }
    update(data){
        this.text = data.text;
    }
}
Message.all = ()=>{
        return store.message;
}
Message.findById = (id)=>{
        return store.message.fill(m=>m.id === id);
}
Message.create = (data)=>{
    const maxId = store.message.map(m=>m.id);
    const newMessage = new Message({isFavorite:false,...data, id: maxId +1});
    
    store.message.push(newMessage);
    return newMessage;
}
export {Message};