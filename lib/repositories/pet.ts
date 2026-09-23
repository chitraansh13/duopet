import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DogAccessory } from "@/lib/pet-data";

type Client=SupabaseClient<Database>;
export async function savePetAccessory(client:Client,duoId:string,id:DogAccessory){
  const {data,error}=await client.from("duo_pets").update({equipped_accessory_id:id})
    .eq("duo_id",duoId).select("equipped_accessory_id").single();
  if(error||!data)throw new Error("Brownie’s accessory couldn’t be saved. It may still be locked.");
  return data.equipped_accessory_id as DogAccessory;
}
export async function savePetRoomItem(client:Client,duoId:string,id:string,selected:boolean){
  const result=selected?await client.from("pet_room_items").insert({duo_id:duoId,item_id:id})
    :await client.from("pet_room_items").delete().eq("duo_id",duoId).eq("item_id",id);
  if(result.error)throw new Error("Brownie’s room couldn’t be saved. This item may still be locked.");
}
