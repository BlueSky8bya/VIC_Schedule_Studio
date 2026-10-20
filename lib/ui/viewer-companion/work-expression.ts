import type {CompanionPlay} from "@/lib/ui/viewer-companion/brain";
import type {CompanionPreferences} from "@/lib/ui/viewer-companion/preferences";
/** One public editor overlay receives at most two actually completed poses.
 * Geometry permission, needs, manual owners and clocks remain in the caller.
 * Editing/focus/workspace/prefs changes inside that overlay never rearm it. */
export type CompanionWorkExpressionOffer = Readonly<{ session:number; ordinal:number; clip:number }>;
export function createCompanionWorkExpressions() {
  let overlay=false, editing=false, armed=false, session=0, completed=0, clip=0;
  const available=()=>overlay&&editing&&armed&&completed<2;
  return {
    observe(open:boolean,publicEditing:boolean) {
      if(!open){overlay=false;editing=false;armed=false;completed=0;return;}
      if(!overlay){overlay=true;armed=false;completed=0;session++;}
      editing=publicEditing;
      if(editing)armed=true;
    },
    available,
    offer():CompanionWorkExpressionOffer|undefined {
      return available()?{session,ordinal:completed,clip}:undefined;
    },
    complete(offer:CompanionWorkExpressionOffer,input:{eligible:boolean;kind:string;pose:boolean;travel:boolean}) {
      if(!available()||!input.eligible||input.travel||!input.pose||!["play","sniff","stretch"].includes(input.kind)
        ||offer.session!==session||offer.ordinal!==completed||offer.clip!==clip)return false;
      completed++;clip=(clip+1)%3;return true;
    },
    snapshot:()=>({overlay,editing,armed,session,completed,clip}),
  };
}

// The enabled toggle unmounts the actor while the page/editor may remain.
// A weak page-ref owner preserves only this finite counter across that actor
// remount; no DOM lookup, account/content data, persistent store or listener.
const owners=new WeakMap<object,ReturnType<typeof createCompanionWorkExpressions>>();
export function companionWorkExpressionsFor(owner:object) {
  let session=owners.get(owner);
  if(!session){session=createCompanionWorkExpressions();owners.set(owner,session);}
  return session;
}

export function companionWorkExpressionPose(offered:CompanionPlay|"sniff"|"stretch",preferences:Pick<CompanionPreferences,"sleep"|"jump"|"petting">) {
  if(!preferences.sleep&&offered==="doze-curl")return "stretch";
  if(!preferences.sleep&&offered==="cozy-nest")return "groom";
  return !preferences.petting&&["ask-petting","lean-nuzzle"].includes(offered)||!preferences.jump&&offered==="pounce"?"bow":offered;
}
