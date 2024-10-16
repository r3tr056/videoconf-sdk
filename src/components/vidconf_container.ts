import { SocketEvent } from '../interfaces/response_data';
import { connectSession, createSession, verifySocket } from '../modules/api_service';
import { generateId } from '../modules/utils';
import { VideoConfRTC } from '../modules/videoconf_rtc';
import { SocketService } from '../modules/websocket_service';

export interface ConnectSessionCredentials {
    host: string;
    password: string;
}

export interface CreateSessionCredentials extends ConnectSessionCredentials {
    title: string;
}

export interface User {
    id: string;
    stream: MediaStream;
}

export interface ConferenceOptions {
    container: HTMLElement;
    stunServers: typeof STUN_SERVERS;
}

export enum ConferenceState {
    INVALID,
    VALID_URL,
    LOGGED,
    JOINED
}

export const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ],
}

export class VideoConfContainer {

    private state: ConferenceState = ConferenceState.INVALID;
    private url: string;
    private connection?: SocketService;
    private localStream?: MediaStream;
    private userId: string = generateId();
    private users: Record<string, User> = {};
    private socketUrl?: string;
    public title: string = '';
    private stunServers: typeof STUN_SERVERS;
    private container: HTMLElement;
    private rtcPeerConnections: Record<string, VideoConfRTC> = {};
    private isInitiator: boolean;
    
    /**
     * Constructor for initializing the video conference container.
     * @param conferenceUrl - The URL for the video conference.
     * @param options - Options containing the container element and STUN servers for WebRTC.
     */
    constructor(conferenceUrl: string, options: ConferenceOptions) {
        this.url = conferenceUrl;
        this.stunServers = options.stunServers || STUN_SERVERS;
        this.container = options.container;
        this.isInitiator = false;

        window.addEventListener('beforeunload', this.beforeUnloadHandler.bind(this));
        this.verifyConferenceUrl();
    }

    /**
     * Verifies if the conference URL is valid by contacting the server.
     */
    private async verifyConferenceUrl() {
        try {
            await verifySocket(this.url);
            this.state = ConferenceState.VALID_URL;
        } catch (error) {
            console.error('Invalid URL:', error);
            throw new Error(`Invalid URL: ${error}`);
        }
    }

    /**
     * Cleanup handler when user navigates away or closes the window.
     * It sends a disconnect message to the server.
     */
    private beforeUnloadHandler() {
        if (this.connection?.isOpen) {
            this.connection.send('disconnect', this.userId);
        }
    }

    /**
     * Creates a new session using the provided credentials.
     * @param credentials - The credentials to create a session (host, title, and password).
     */
    async createSession(credentials: CreateSessionCredentials) {
        try {
            const response = await createSession(credentials.host, credentials.title, credentials.password);
            if (response.data.title) {
                this.title = response.data.title;
            }
            if (response.data.socket) {
                this.socketUrl = response.data.socket;
            }
            this.state = ConferenceState.LOGGED;
        } catch (error) {
            console.error('Connection failed: ', error);
            this.state = ConferenceState.INVALID;
            throw new Error(`Connection failed: ${error}`)
        }
    }

    /**
     * Connects to an existing session using provided credentials.
     * @param credentials - Credentials to connect to the session (host and password).
     */
    async connect(credentials: ConnectSessionCredentials) {
        connectSession(credentials.host, credentials.password, this.url).then((response) => {
            if (response.data.title) {
                this.title = response.data.title;
            }

            if (response.data.socket) {
                this.socketUrl = response.data.socket;
            }

            this.state = ConferenceState.LOGGED;
        }).catch((error) => {
            console.error('Connection failed: ', error);
            this.state = ConferenceState.INVALID;
            throw new Error(`Connection failed: ${error}`);
        })
    }

    /**
     * Joins the meeting by setting up media and connecting to the socket.
     */
    public joinMeeting() {
        if (this.state === ConferenceState.LOGGED) {
            this.state = ConferenceState.JOINED;
            this.setupMedia();
            this.connectToSocket();
        } else if (this.state === ConferenceState.JOINED) {
            this.state = ConferenceState.LOGGED;
        }
    }

    /**
     * Sets up local media (camera and microphone) for the conference.
     */
    async setupMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
            this.localStream = stream;
            this.displayLocalStream(stream);
        } catch(error) {
            console.error('Error accessing media devices: ', error);
            throw new Error(`Error accessing media devices: ${error}`);
        }
    }

    /**
     * Displays the local video stream on the user interface.
     * @param stream - MediaStream object of the local video.
     */
    private displayLocalStream(stream: MediaStream) {
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.autoplay = true;
        this.container.appendChild(videoElement);
    }

    /**
     * Connects to the WebSocket server for signaling.
     */
    private connectToSocket() {
        if (!this.socketUrl) return;

        this.connection = new SocketService(`${this.socketUrl}`);
        this.connection.onOpen(this.handleSocketOpen.bind(this));
        this.connection.onMessage(this.handleSocketMessage.bind(this));
    }

    /**
     * Handles the WebSocket connection open event.
     */
    private handleSocketOpen() {
        this.connection?.send('connect', this.userId);
    }

    /**
     * Handles the incoming WebSocket messages.
     * @param event - The WebSocket event data.
     */
    private handleSocketMessage(event: SocketEvent) {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'session_joined':
                if (data.initiator) {
                    this.isInitiator = true;
                }
                this.connection?.send('start_call', this.userId);
                break;
            case 'start_call':
                this.handleStartCall(data);
                break;
            case 'offer':
                this.handleOffer(data);
                break;
            case 'answer':
                this.handleAnswer(data);
                break;
            case 'ice':
                this.handleIceCandidate(data);
                break;
            case 'disconnect':
                this.handleDisconnect(data);
                break;
            default:
                throw new Error(`Invalid socket data: ${data}`)
        }
    }

    /**
     * Starts a WebRTC call after joining the session.
     * @param data - Data about the session join event.
     */
    private handleStartCall(data: any) {
        if (data.userID !== this.userId) {
            if (this.isInitiator) {
                this.createPeerConnection(data.userID);
                this.rtcPeerConnections[data.userID].createOffer().then((description) => {
                    this.connection?.sendDescription('offer', description, this.userId, data.userID);
                });
            }
        }
    }

    /**
     * Handles an incoming WebRTC offer.
     * @param data - Data containing the offer description.
     */
    private handleOffer(data: any) {
        if (data.to === this.userId) {
            this.createPeerConnection(data.userID);
            this.rtcPeerConnections[data.userID].setRemoteDescription(new RTCSessionDescription(JSON.parse(data.description))).then(async () => {
                const answer = await this.rtcPeerConnections[data.userID].createAnswer();
                this.connection?.sendDescription('answer', answer, this.userId, data.userID);
            });
        }
    }

    /**
     * Handles an incoming WebRTC answer.
     * @param data - Data containing the answer description.
     */
    private handleAnswer(data: any) {
        if (data.to === this.userId) {
            this.rtcPeerConnections[data.userID].receiveAnswer(JSON.parse(data.description));
        } else {
            console.error('No peer connection found for user', data.userID);
        }
    }

    /**
     * Handles an ICE candidate received over WebSocket.
     * @param data - Data containing the ICE candidate information.
     */
    private handleIceCandidate(data: any) {
        if (data.candidate && data.userID !== this.userId) {
            this.rtcPeerConnections[data.userID].addIceCandidate(JSON.parse(data.candidate));
        }
    }

    /**
     * Handles user disconnect event from WebSocket.
     * @param data - Data of the user who disconnected.
     */
    private handleDisconnect(data: any) {
        if (data.userID !== this.userId) {
            this.removeUser(data.userID);
        }
        // invoke user defined callbacks
        this.onUserLeft(data.userID);
    }

    /**
     * Callback when a user leaves the conference.
     * This can be overridden by SDK consumers.
     * @param userId - ID of the user who left the meeting.
     */
    public onUserLeft(userId: string) {
        console.warn('onUserLeft should be implemented by the SDK consumer.');
    }

    /**
     * Creates a new WebRTC peer connection for a user.
     * @param userId - The ID of the user to connect to.
     */
    private createPeerConnection(userID: string) {
        if (!this.rtcPeerConnections[userID]) {
            if (!this.users[userID]) {
                this.users[userID] = { id: this.userId, stream: new MediaStream()};
            }

            this.rtcPeerConnections[userID] = new VideoConfRTC(this.stunServers, this.localStream!);
            this.rtcPeerConnections[userID].onIceCandidate((event) => {
                if (event.candidate) {
                    this.connection?.candidate(event.candidate, this.userId);
                }
            });

            this.rtcPeerConnections[userID].onTrack((event) => {
                const userStream = this.users[userID].stream;
                userStream?.getTracks().forEach((track) => userStream.removeTrack(track));
                userStream?.addTrack(event.track);
                this.displayRemoteStream(userID, this.users[userID].stream!);
                // invoke user-define callbacks
                this.onRemoteStream(userID, this.users[userID].stream!);
            });
        }
    }

    /**
     * Handles the incoming media track (remote user's stream).
     * @param stream - The MediaStream received from the peer.
     * @param userId - The ID of the user who sent the stream.
     */
    public onRemoteStream(userId: string, stream: MediaStream) {
        console.warn('onRemoteStream should be implemented by the SDK consumer.');
    }

    /**
     * Displays the remote user's stream on the UI.
     * @param stream - The MediaStream of the remote user.
     * @param userId - The ID of the remote user.
     */
    private displayRemoteStream(userID: string, stream: MediaStream) {
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.id = `${userID}-video`;
        this.container.appendChild(videoElement);
    }

    /**
     * Removes a user from the conference.
     * @param userId - The ID of the user to remove.
     */
    private removeUser(userID: string) {
        if (this.rtcPeerConnections[userID]) {
            this.rtcPeerConnections[userID].disconnect();
            delete this.rtcPeerConnections[userID];
        }

        if (this.users[userID]) {
            this.users[userID].stream.getTracks().forEach(track => track.stop());
            delete this.users[userID];
        }

        const videoElement = document.getElementById(`${userID}-video`);
        if (videoElement) {
            this.container.removeChild(videoElement);
        }
    }

    /**
     * Disconnects the user from the session and cleans up resources.
     */
    public leaveMeeting() {
        this.connection?.send('disconnect', this.userId);
        Object.keys(this.users).forEach(userID => this.removeUser(userID));
        this.connection?.disconnect();
        this.state = ConferenceState.LOGGED;
    }
}