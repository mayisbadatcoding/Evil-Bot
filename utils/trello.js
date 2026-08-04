const TRELLO_API='https://api.trello.com/1';
function configured(){ return Boolean(process.env.TRELLO_KEY && process.env.TRELLO_TOKEN); }
async function trello(path, options={}){
  if(!configured()) throw new Error('Trello is not configured.');
  const url=new URL(`${TRELLO_API}${path}`);
  url.searchParams.set('key',process.env.TRELLO_KEY);
  url.searchParams.set('token',process.env.TRELLO_TOKEN);
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  if(!response.ok) throw new Error(`Trello ${response.status}: ${await response.text()}`);
  return response.json();
}
async function createCard({name,desc,listId,due}){
  return trello('/cards',{method:'POST',body:JSON.stringify({name,desc,idList:listId,due:due||null})});
}
async function addComment(cardId,text){ return trello(`/cards/${encodeURIComponent(cardId)}/actions/comments`,{method:'POST',body:JSON.stringify({text})}); }
module.exports={configured,createCard,addComment};
