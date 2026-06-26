import argparse
from PIL import Image
import sys

config = {
#     "hollowknight": {
#     "area": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "lifeblood_cocoon": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "npc": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "soul_totem": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "whispering_root": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "bench": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "dreamer": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "hot_spring": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "stag_station": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "tram_station": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "vendor": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "arcane_egg": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "captive_grub": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "charm_notch": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "hallownest_seal": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "kings_idol": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "mask_shard": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "vessel_fragment": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "wanderers_journal": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "geo_deposit": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "pale_ore": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "rancid_egg": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "relic": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "treasure_chest": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "ability": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "charm": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "nail_art": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "spell": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "boss": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "grimm_troupe": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "journal_entry": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "warriors_dream": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "quest": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "quest_item": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "trial": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "achievement": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "breakable_surface": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "easter_egg": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "lever": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "lore": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "miscellaneous": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "placeholder_9": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "shade_gate": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "shortcut": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 352,
#         "pixelRatio": 2
#     }
# },
# "baldursgate":{
#     "area": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "ladder": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "point_of_interest": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "restoration": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "secret": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "transition": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "waypoint": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "book": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "chest": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "consumable": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "container": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "crafting_ingredient": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "illithid_tadpole": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "key": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "ornate_chest": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "other_item": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "quest_item": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "scroll": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "soul_coin": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "tool": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "valuable": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "unique_accessory": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "unique_armor": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "unique_item": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "unique_weapon": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "animal": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "follower": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "npc": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "party_member": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "trader": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "companion_quest": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "inspirational_event": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "main_quest": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "side_quest": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "boss": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "encounter": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "buff": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "door_passage": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "easter_egg": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "lever": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "miscellaneous": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "trap": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 440,
#         "pixelRatio": 2
#     }
# },
# "wukong": {
#     "keeper_shrine": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "location": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "meditation_spot": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "point_of_interest": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "awaken_wine_worm": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "celestial_pill": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "drink": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "formula": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "gourd": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "key_item": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "luojia_fragrant_vine": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "seeds": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "soak": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "spirit": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "chest": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "consumable": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "item": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "valuable": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "will": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "armor": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "curio": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "spell": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "talisman": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "transformation_spell": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "vessel": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "weapon": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "character": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "elite_lesser_yaoguai": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "lesser_yaoguai": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "yaoguai_chief": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "yaoguai_king": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 528,
#         "pixelRatio": 2
#     },
#     "main_quest": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "side_quest": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "easter_egg": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "miscellaneous": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "npc": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "placeholder_0": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "placeholder_7": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "placeholder_8": {
#         "width": 66,
#         "height": 88,
#         "x": 66,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "placeholder_9": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "shen_monkey": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "transition": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "aged_ginseng": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "celestial_pear": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 0,
#         "pixelRatio": 2
#     },
#     "fire_bellflower": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "fragrant_jade_flower": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "gentian": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 88,
#         "pixelRatio": 2
#     },
#     "jade_lotus": {
#         "width": 66,
#         "height": 88,
#         "x": 132,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "licorice": {
#         "width": 66,
#         "height": 88,
#         "x": 396,
#         "y": 176,
#         "pixelRatio": 2
#     },
#     "millenium_ginseng": {
#         "width": 66,
#         "height": 88,
#         "x": 198,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "nine_capped_lingzhi": {
#         "width": 66,
#         "height": 88,
#         "x": 330,
#         "y": 264,
#         "pixelRatio": 2
#     },
#     "purple_lingzhi": {
#         "width": 66,
#         "height": 88,
#         "x": 264,
#         "y": 352,
#         "pixelRatio": 2
#     },
#     "snake_head_mushroom": {
#         "width": 66,
#         "height": 88,
#         "x": 0,
#         "y": 440,
#         "pixelRatio": 2
#     },
#     "tree_pearl": {
#         "width": 66,
#         "height": 88,
#         "x": 462,
#         "y": 440,
#         "pixelRatio": 2
#     }
# }
"silksong":{
    "npc": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 264,
        "pixelRatio": 2
    },
    "plasmium_cocoon": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 264,
        "pixelRatio": 2
    },
    "point_of_interest": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 264,
        "pixelRatio": 2
    },
    "point_of_interest_3": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 352,
        "pixelRatio": 2
    },
    "point_of_interest_4": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 352,
        "pixelRatio": 2
    },
    "point_of_interest_5": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 352,
        "pixelRatio": 2
    },
    "soul_totem": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 528,
        "pixelRatio": 2
    },
    "void_mass": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 528,
        "pixelRatio": 2
    },
    "whispering_root": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 616,
        "pixelRatio": 2
    },
    "bellway_station": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 0,
        "pixelRatio": 2
    },
    "bench": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 0,
        "pixelRatio": 2
    },
    "dreamer": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 88,
        "pixelRatio": 2
    },
    "hot_spring": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 88,
        "pixelRatio": 2
    },
    "location_2": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 176,
        "pixelRatio": 2
    },
    "location_3": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 176,
        "pixelRatio": 2
    },
    "location_4": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 176,
        "pixelRatio": 2
    },
    "location_5": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 176,
        "pixelRatio": 2
    },
    "tram_station": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 528,
        "pixelRatio": 2
    },
    "vendor": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 528,
        "pixelRatio": 2
    },
    "ventrica_station": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 528,
        "pixelRatio": 2
    },
    "arcane_egg": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 0,
        "pixelRatio": 2
    },
    "bone_scroll": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 0,
        "pixelRatio": 2
    },
    "choral_commandment": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 88,
        "pixelRatio": 2
    },
    "lost_flea": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 176,
        "pixelRatio": 2
    },
    "mask_shard": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 176,
        "pixelRatio": 2
    },
    "materium_entry": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 176,
        "pixelRatio": 2
    },
    "memento": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 176,
        "pixelRatio": 2
    },
    "memory_locket": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 264,
        "pixelRatio": 2
    },
    "psalm_cylinder": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 352,
        "pixelRatio": 2
    },
    "rune_harp": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 440,
        "pixelRatio": 2
    },
    "silk_heart": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 440,
        "pixelRatio": 2
    },
    "spool_fragment": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 528,
        "pixelRatio": 2
    },
    "vessel_fragment": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 528,
        "pixelRatio": 2
    },
    "weaver_effigy": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 616,
        "pixelRatio": 2
    },
    "area_map": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 0,
        "pixelRatio": 2
    },
    "craftmetal": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 88,
        "pixelRatio": 2
    },
    "item_4": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 88,
        "pixelRatio": 2
    },
    "mossberry": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 264,
        "pixelRatio": 2
    },
    "pale_ore": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 264,
        "pixelRatio": 2
    },
    "pollip_heart": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 352,
        "pixelRatio": 2
    },
    "rancid_egg": {
        "width": 66,
        "height": 88,
        "x": 396,
        "y": 352,
        "pixelRatio": 2
    },
    "relic": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 352,
        "pixelRatio": 2
    },
    "rosary": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 352,
        "pixelRatio": 2
    },
    "rosary_string": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 352,
        "pixelRatio": 2
    },
    "ruined_tool": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 440,
        "pixelRatio": 2
    },
    "shard_bundle": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 440,
        "pixelRatio": 2
    },
    "shell_shards": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 440,
        "pixelRatio": 2
    },
    "silkeater": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 440,
        "pixelRatio": 2
    },
    "treasure_chest": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 528,
        "pixelRatio": 2
    },
    "ability": {
        "width": 66,
        "height": 88,
        "x": 0,
        "y": 0,
        "pixelRatio": 2
    },
    "crest": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 88,
        "pixelRatio": 2
    },
    "equipment": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 88,
        "pixelRatio": 2
    },
    "silk_skill": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 440,
        "pixelRatio": 2
    },
    "tool": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 528,
        "pixelRatio": 2
    },
    "upgrade": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 528,
        "pixelRatio": 2
    },
    "area": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 0,
        "pixelRatio": 2
    },
    "boss": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 0,
        "pixelRatio": 2
    },
    "journal_entry": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 88,
        "pixelRatio": 2
    },
    "objective": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 264,
        "pixelRatio": 2
    },
    "quest_item": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 352,
        "pixelRatio": 2
    },
    "wish": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 616,
        "pixelRatio": 2
    },
    "achievement": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 0,
        "pixelRatio": 2
    },
    "breakable_surface": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 0,
        "pixelRatio": 2
    },
    "easter_egg": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 88,
        "pixelRatio": 2
    },
    "lever": {
        "width": 66,
        "height": 88,
        "x": 594,
        "y": 88,
        "pixelRatio": 2
    },
    "locked_door": {
        "width": 66,
        "height": 88,
        "x": 264,
        "y": 176,
        "pixelRatio": 2
    },
    "lore": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 176,
        "pixelRatio": 2
    },
    "miscellaneous": {
        "width": 66,
        "height": 88,
        "x": 66,
        "y": 264,
        "pixelRatio": 2
    },
    "needolin_door": {
        "width": 66,
        "height": 88,
        "x": 198,
        "y": 264,
        "pixelRatio": 2
    },
    "placeholder_9": {
        "width": 66,
        "height": 88,
        "x": 462,
        "y": 264,
        "pixelRatio": 2
    },
    "shade_gate": {
        "width": 66,
        "height": 88,
        "x": 132,
        "y": 440,
        "pixelRatio": 2
    },
    "shortcut": {
        "width": 66,
        "height": 88,
        "x": 330,
        "y": 440,
        "pixelRatio": 2
    },
    "silk_wall": {
        "width": 66,
        "height": 88,
        "x": 528,
        "y": 440,
        "pixelRatio": 2
    }
}
}

"""
python crop_image.py <input_file> <output_file> -x <x_coord> -y <y_coord> -w <width> -H <height>
"""
def crop_image(input_path, output_path, x, y, width, height):
    try:
        # Open the image
        with Image.open(input_path) as img:
            img_width, img_height = img.size
            
            # Check if the crop coordinates are within the image boundaries
            if x < 0 or y < 0 or x + width > img_width or y + height > img_height:
                print(f"Warning: The requested crop box {x, y, width, height} goes outside the image boundaries {img_width}x{img_height}.")
                print("The image will be cropped to the edge of the original image.")

            # Pillow uses a tuple of (left, upper, right, lower) for cropping
            left = x
            upper = y
            right = x + width
            lower = y + height
            
            crop_box = (left, upper, right, lower)
            
            # Perform the crop
            cropped_img = img.crop(crop_box)
            
            # Save the result
            cropped_img.save(output_path)
            print(f"Successfully cropped image saved to: {output_path}")

    except FileNotFoundError:
        print(f"Error: The file '{input_path}' was not found.", file=sys.stderr)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)

def main():
    # parser = argparse.ArgumentParser(description="Crop a chunk out of an image.")
    
    # # Define arguments
    # parser.add_argument("input_image", help="Path to the input image file")
    # parser.add_argument("output_image", help="Path to save the cropped image")
    # parser.add_argument("-x", type=int, required=True, help="Starting X coordinate (left)")
    # parser.add_argument("-y", type=int, required=True, help="Starting Y coordinate (top)")
    # parser.add_argument("-w", "--width", type=int, required=True, help="Width of the chunk to cut out")
    # parser.add_argument("-H", "--height", type=int, required=True, help="Height of the chunk to cut out")

    # args = parser.parse_args()

    # crop_image(args.input_image, args.output_image, args.x, args.y, args.width, args.height)
    for game, conf in config.items():
        for k, v in conf.items():
            crop_image(f"{game}.png", f"{game}/{game}-{k.replace("_", "-")}.png", v["x"], v["y"], v["width"], v["height"])

if __name__ == "__main__":
    main()