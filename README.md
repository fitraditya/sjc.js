# sjc.js

Simple [janus](https://github.com/meetecho/janus-gateway) client API. It aims to simplify [janus](https://github.com/meetecho/janus-gateway) client API.

# Supported Plugins

- Video Room

# Examples

- Video Room ([example](https://github.com/fitraditya/sjc.js/tree/master/example/videoroom))

# API

## Video Room

### Initialization

```html
<script src="sjc.videoroom.js"></script>
```

```javascript
videoroom = new VideoRoom("ws://localhost:8020");
```

### Methods

#### Create Room

Parameter:
- Room: integer

```javascript
videoroom.createRoom(room);
```

#### Join Room

Parameter:
- Room: integer

```javascript
videoroom.joinRoom(room);
```

#### Publish

Parameter:
- displayName: string

```javascript
videoroom.publish(displayName);
```

#### Unpublish

```javascript
videoroom.unpublish();
```

#### Subscribe

Parameter:
- target: string

```javascript
videoroom.string(target);
```

### Events

#### `videoroom.onReady = function() {}`

Called when user connected to janus signaling server.

#### `videoroom.onJoinRoom = function(data) {}`

Called when user joined to room.

#### `videoroom.onLocalStream = function(stream) {}`

Called when user has a local video (stream).

#### `videoroom.onRemoteStream = function(stream) {}`

Called when user received a remote video (stream) after subscribing.

#### `videoroom.onEvent = function(event, data) {}`

Called when user received a janus event.

#### `videoroom.onError = function(error) {}`

Called when error occured.
