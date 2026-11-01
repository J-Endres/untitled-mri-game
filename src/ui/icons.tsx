/** Pixel icons from Crusenho's Icons Essential (CC BY 4.0, see src/assets/CREDITS.md). */
import enter from '../assets/icons/enter.png'
import exit from '../assets/icons/exit.png'
import info from '../assets/icons/info.png'
import play from '../assets/icons/play.png'
import search from '../assets/icons/search.png'
import trashbin from '../assets/icons/trashbin.png'
import trophy from '../assets/icons/trophy.png'

const icons = { enter, exit, info, play, search, trashbin, trophy }

/** Decorative icon; the button's text or aria-label carries the meaning. */
export function Icon({ name }: { name: keyof typeof icons }) {
  return <img className="icon" src={icons[name]} alt="" />
}
