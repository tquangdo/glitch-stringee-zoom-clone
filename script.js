const videoContainer = document.querySelector("#videosContainer ");

const vm = new Vue({
  el: "#app-dotq",
  data: {
    userToken: "",
    roomId: "",
    roomToken: "",
    room: undefined,
    callClient: undefined
  },
  computed: {
    roomUrl: function() {
      return `https://${location.hostname}?room=${this.roomId}`;
    }
  },
  async mounted() { //tương tự render() of ReactJS
    api.setRestToken();

    const urlParams = new URLSearchParams(location.search);
    //"room" là <https://zoom-clone-dotq.glitch.me?room=room-vn-1-RUC6UVOCUM-1603728652875>
    const roomId = urlParams.get("room");
    if (roomId) {
      this.roomId = roomId;

      await this.join();
    }
  },
  methods: {
    authen2Join: function() {
      return new Promise(async resolve => {
        const userId = `${(Math.random() * 100000).toFixed(6)}`;
        const userToken = await api.getUserToken(userId);
        this.userToken = userToken;

        if (!this.callClient) {
          const client = new StringeeClient(); //github > test_room.html > stringeeClient = new StringeeClient()

          client.on("authen", function(res) {
            resolve(res);
          });
          this.callClient = client;
        }
        this.callClient.connect(userToken);
      });
    },
    //button "Vô Meeting" cùng vị trí với button "Share màn hình" vì index.html > <button class="button is-info">
    publishVideo: async function(screenSharing = false) {
      //github > test_room.html > StringeeVideo.createLocalVideoTrack()
      // với WCam cũ thì hiện ERR: "DOMException: Requested device not found" + KO hiện WCam (track)
      const localTrack = await StringeeVideo.createLocalVideoTrack(
        this.callClient,
        {
          audio: true, //mute chỗ này!!!
          video: true,
          screen: screenSharing,
          videoDimensions: { width: 640, height: 360 }
        }
      );

      const videoElement = localTrack.attach();
      this.addVideo(videoElement);

      //github > test_room.html > StringeeVideo.joinRoom()
      const roomData = await StringeeVideo.joinRoom(
        this.callClient,
        this.roomToken
      );
      const room = roomData.room;

      if (!this.room) {
        this.room = room;
        //github > test_room.html > room events: join/leaveroom, message, add/removetrack...
        room.clearAllOnMethos();
        room.on("addtrack", e => {
          const track_info  = e.info.track;
          if (track_info .serverId === localTrack.serverId) {
            return;
          }
          this.onSubscribe(track_info );
        });
        //khi 1 phía tắt WCam thì các phía còn lại auot xóa khung WCam đó
        room.on("removetrack", e => {
          const track = e.track;
          if (!track) {
            return;
          }

          const mediaElements = track.detach();
          mediaElements.forEach(element => element.remove());
        });

        // Join existing tracks
        roomData.listTracksInfo.forEach(item_track_info => this.onSubscribe(item_track_info));
      }

      await room.publish(localTrack);
    },
    createRoomDoTQ: async function() {
      const room = await api.createRoomDoTQ();
      const { roomId } = room;
      const roomToken = await api.getRoomToken(roomId);

      this.roomId = roomId;
      this.roomToken = roomToken;
      // console.log({ roomId, roomToken });

      await this.authen2Join();
      await this.publishVideo();
    },
    join: async function() {
      const roomToken = await api.getRoomToken(this.roomId);
      this.roomToken = roomToken;

      await this.authen2Join();
      await this.publishVideo();
    },
    joinRoomWithId: async function() {
      const roomId = prompt("Dán Room ID vào đây nhé!");
      if (roomId) {
        this.roomId = roomId;
        await this.join();
      }
    },
    onSubscribe: async function(arg_track_info) {
      const track = await this.room.subscribe(arg_track_info.serverId);
      track.on("ready", () => {
        const videoElement = track.attach();
        this.addVideo(videoElement);
      });
    },
    addVideo: function(video) {
      video.setAttribute("controls", "true");
      video.setAttribute("playsinline", "true");
      videoContainer.appendChild(video); //append liên tục WCam + share screen
    }
  }
});
