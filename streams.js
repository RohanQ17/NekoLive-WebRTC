
const appId= '6cc682162c644073bf5e4aede97b7ffd'
const appCertificate = '83b3ba5bb1da408db209a95d0c37f98f'
let localStream
let remoteStream
let peerConnection

let token = null;

let uid = String(Math.floor(Math.random()*10000))

let client;
let channel;

const servers = {
    iceServer:[
        {
            urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
        }
    ]
}
let init = async()=>{
    client = await AgoraRTM.createInstance(appId)
    await client.login({uid,token})

    channel = client.createChannel('main')
    await channel.join()
    channel.on('MemberJoined',handleUserJoined)
    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio: false})
    document.getElementById('user-1').srcObject = localStream
    createOffer()
}

let handleUserJoined = async (MemberId)=>{
    console.log('A new user joined the channel',MemberId)
}

let createOffer = async ()=>{
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream

    localStream.getTracks().forEach((track)=>{
        peerConnection.addTrack(track,localStream)
    })

    peerConnection.ontrack = (event)=>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack()
        })
    }

    peerConnection.onicecandidate = async(event)=>{
        if(event.candidate){
            console.log('New ICE candidate',event.candidate)
        }
    }
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    console.log(offer)
}
init()