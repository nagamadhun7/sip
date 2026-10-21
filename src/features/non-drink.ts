const drinkWords=/\b(drink|water|coffee|espresso|latte|tea|milk|juice|cola|soda|smoothie|shake|beer|wine|cocktail|lemonade|cocoa|chocolate|kombucha)\b/i;
const foodWords=/\b(pizza|pasta|sandwich|burger|steak|chicken|salad|cake|bread|rice|meal|medicine|pill|supplement|extract|powder)\b/i;
export function partitionInput(text:string,names:string[]=[]){
 const parts=text.split(/\s*(?:\r?\n|,|;|\band\b|\bthen\b)\s*/).filter(p=>p.trim());
 const drinks:string[]=[],skipped:string[]=[],soup:string[]=[];
 if(/\b(ignore|system prompt|override|instructions|detox|burns? fat|blood pressure)\b/i.test(text))return {drinks,skipped:[text],soup};
 for(const part of parts){
  if(/\b(soup|broth)\b/i.test(part)){soup.push(part);continue;}
  const known=names.some(n=>part.toLowerCase().includes(n.toLowerCase()));
  if(foodWords.test(part)||(!drinkWords.test(part)&&!known))skipped.push(part);else drinks.push(part);
 }
 return {drinks,skipped,soup};
}
