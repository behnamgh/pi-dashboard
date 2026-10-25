import { ROOMS } from '../../../shared/contracts.js';
import { Overview } from './Overview.jsx';
export function Rooms({ data, roomId, onRoomChange, navigate }) {
  return <><div className="room-picker" aria-label="Choose a room">{ROOMS.map(room => <button className={'room-button ' + (roomId === room.id ? 'selected' : '')} key={room.id} aria-pressed={roomId === room.id} onClick={() => onRoomChange(room.id)}>{room.name}</button>)}</div><Overview data={data} navigate={navigate} roomId={roomId}/></>;
}
