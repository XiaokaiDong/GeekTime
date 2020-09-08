const RENDER_TO_DOM = Symbol("render to dom");

class ElementWrapper {
    constructor(type) {
        this.root = document.createElement(type);  //挂载在一个实DOM上，使用代理模式
    }
    setAttribute(name, value) {
        if(name.match(/^on([\s\S]+)/)) {
            this.root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
        }else {
            if (name === "className") {
                this.root.setAttribute("class", value);
            } else {
                this.root.setAttribute(name, value);
            }
            
        }
    }
    appendChild(commponent) {
        let range = document.createRange();
        // 添加到最后的位置
        range.setStart(this.root, this.root.childNodes.length);
        // 不能用parentElement.children，因为可能是文本或者注释节点
        range.setEnd(this.root, this.root.childNodes.length);
        commponent[RENDER_TO_DOM](range);
        
    }
    [RENDER_TO_DOM](range) {
        range.deleteContents();
        range.insertNode(this.root);
    }
}

class TextWrapper {
    constructor(content) {
        this.root = document.createTextNode(content);
    }
    [RENDER_TO_DOM](range) {
        range.deleteContents();
        range.insertNode(this.root);
    }
}

export class Component {
    constructor(content) {
        this.props = Object.create(null);
        this.children = [];
        this._root = null;
        this._range = null;
    }
    setAttribute(name, value) {
        this.props[name] = value;
    }
    appendChild(component) {
        this.children.push(component);
    }

    // 使用[RENDER_TO_DOM]的形式来达到申明私有成员的效果
    [RENDER_TO_DOM](range) {
        this._range = range;  //保存range
        //这里的render类似于JAVA或C++中的抽象方法。因为JAVASCRIPT是所类型的语言，
        //所以直接写一个需要在子类中实现的方法即可（因为弱类型，所以不需要在这里声明）
        this.render()[RENDER_TO_DOM](range);   //递归
    }
    rerender() {
        // 保存老的range
        let oldRange = this._range;

        // 在老Range开始创建新的Range
        let range = document.createRange();
        range.setStart(oldRange.startContainer, oldRange.startOffset);
        range.setEnd(oldRange.startContainer, oldRange.startOffset);
        this[RENDER_TO_DOM](range);  // 和[RENDER_TO_DOM](range)中不同，这里不再递归
 
        // 将老range的开始移动到新插入range之后
        oldRange.setStart(range.endContainer, range.endOffset);
        oldRange.deleteContents();
        
    }
    setState(newState) {
        //因为typeof null === "object"，所以null值判断要单独进行
        if (this.state === null || typeof this.state !== "object") {
            this.state = newState;
            this.rerender();
            return;
        }
        
        let merge = (oldState, newState) => {
            for (let p in newState){
                //因为typeof null === "object"，所以null值判断要单独进行
                if(oldState[p] === null || typeof oldState[p] !== "object") {
                    // p属性不是对象，直接抄写
                    oldState[p] = newState[p];
                } else {
                    merge(oldState[p], newState[p]);
                }
            }
        }
        merge(this.state, newState);
        this.rerender();
    }
}

export function createElement(type, attributes, ...children){
    let e;
    if (typeof type === "string") {
        e = new ElementWrapper(type);
    } else {
        e = new type;
    }

    for (let p in attributes) {
        e.setAttribute(p, attributes[p]);
    }

    let insertChildren = (children) => {
        for(let child of children) {
            if (typeof child === "string"){
                child = new TextWrapper(child);
            }
            if (child === null) {
                continue;
            }
            if (typeof child === "object" && (child instanceof Array)){
                insertChildren(child);
            } else {
                e.appendChild(child);
            }
            
        }
    }

    insertChildren(children);

    
    return e;
}

export function render(component, parentElement) {
    // parentElement.appendChild(component.root);
    let range = document.createRange();
    range.setStart(parentElement, 0);
    // 不能用parentElement.children，因为可能是文本或者注释节点
    range.setEnd(parentElement, parentElement.childNodes.length);
    range.deleteContents();
    component[RENDER_TO_DOM](range); 
}