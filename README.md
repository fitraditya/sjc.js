# sjc.js

Simple [janus](https://github.com/meetecho/janus-gateway) client API. It aims to simplify [janus](https://github.com/meetecho/janus-gateway) client API.

# Supported Plugins

- Video Room

# Examples

- Video Room ([example](https://github.com/fitraditya/sjc.js/tree/master/example/videoroom))

# API

## Initialization

```javascript
videoroom = new VideoRoom("ws://localhost:8020");
```

## Method

#### Create ROom

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
