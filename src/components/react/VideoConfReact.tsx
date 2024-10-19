import { Mic, MicOff, Monitor, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from "../common/react_btn";


import { ConferenceOptions, VideoConfContainer } from '../vidconf_container';

const conferenceUrl = ""

export default function VideoConference() {
    const [isJoined, setIsJoined] = useState(false);
    const [users, setUsers] = useState<{ [id: string]: MediaStream }>({});
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const videoConfContainerRef = useRef<VideoConfContainer | null>(null);

    const [isMicOn, setIsMicOn] = useState(true)
    const [isVideoOn, setIsVideoOn] = useState(true)

    const participants = [
        { id: 1, name: 'You' },
        { id: 2, name: 'John Doe' },
        { id: 3, name: 'Jane Smith' },
        { id: 4, name: 'Alice Johnson' },
        { id: 5, name: 'Bob Williams' },
    ]
    useEffect(() => {
        if (videoContainerRef.current) {
            const options: ConferenceOptions = {
                container: videoConfContainerRef.current,
                stunServers: {
                    iceServers: [
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                    ]
                },
            };
            videoConfContainerRef.current = new VideoConfContainer(conferenceUrl, options);

            videoConfContainerRef.current.onUserLeft = (userId) => {
                setUsers(prevUsers => {
                    const updatedUsers = { ...prevUsers };
                    delete updatedUsers[userId];
                    return updatedUsers;
                });
            };
        }

        return () => {
            videoConfContainerRef.current?.leaveMeeting();
        };
    }, [conferenceUrl]);

    const joinMeeting = async () => {
        if (videoConfContainerRef.current) {
            await videoConfContainerRef.current.joinMeeting();
            setIsJoined(true);
        }
    };

    const leaveMeeting = () => {
        if (videoConfContainerRef.current) {
            videoConfContainerRef.current.leaveMeeting();
            setIsJoined(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 p-4">
                    <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video relative">
                        {Object.keys(users).map((userId) => (
                            <video key={userId} autoPlay playsInline ref={(videoElement) => {
                                if (videoElement) {
                                    videoElement.srcObject = users[userId];
                                }
                            }}
                            />
                        ))}
                        <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-60 text-white px-2 py-1 rounded">
                            John Doe is sharing screen
                        </div>
                    </div>
                </div>
                <aside className="w-64 p-4 overflow-y-auto hidden lg:block">
                    <div className="space-y-4">
                        {participants.map((participant) => (
                            <div key={participant.id} className="relative">
                                <img
                                    src={`/placeholder.svg?height=90&width=160&text=${participant.name}`}
                                    alt={participant.name}
                                    className="w-full rounded-lg"
                                />
                                <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-60 text-white text-xs px-1 rounded">
                                    {participant.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>
            <footer className="bg-white border-t p-4">
                <div className="flex justify-center space-x-4">
                    <Button
                        variant={isMicOn ? "default" : "destructive"}
                        size="icon"
                        onClick={() => setIsMicOn(!isMicOn)}
                    >
                        {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant={isVideoOn ? "default" : "destructive"}
                        size="icon"
                        onClick={() => setIsVideoOn(!isVideoOn)}
                    >
                        {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon">
                        <Monitor className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon">
                        <PhoneOff className="h-4 w-4" />
                    </Button>
                </div>
            </footer>
        </div>
    )
}