function _via_test_csv_import() {
    _via_load_test_img();
    // note :
    // - all \" has been replaced with \\"
    // - all ' has been replaced with \'
    var d = '#filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,0,"{""name"":""ellipse"",""cx"":252,""cy"":190,""rx"":27,""ry"":26}","{""name"":""ellipse \\""red\\""""}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,1,"{""name"":""rect"",""x"":290,""y"":208,""width"":127,""height"":113}","{""name"":""rectangle \'black\'""}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,2,"{""name"":""point"",""cx"":51,""cy"":37}","{""name"":""red \\""dot\\""""}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,3,"{""name"":""point"",""cx"":253,""cy"":40}","{""name"":""unknown 598 fjs £$ *(&£^""}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,4,"{""name"":""point"",""cx"":453,""cy"":37}","{""name"":""1564865""}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,5,"{""name"":""circle"",""cx"":148,""cy"":268,""r"":43}","{}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,6,"{""name"":""ellipse"",""cx"":554,""cy"":255,""rx"":33,""ry"":57}","{}"\ntest_pattern_qbist.jpg,129855,"{""caption"":""+-08374*&$£*""}",8,7,"{""name"":""point"",""cx"":638,""cy"":475}","{}"\na_swan_swimming_in_geneve_lake.jpg,62201,"{""caption"":""a swan in geneve lake\\""""}",1,0,"{""name"":""polygon"",""all_points_x"":[121,105,188,405,406,428,403,338,327,225,159,121],""all_points_y"":[172,212,292,299,238,219,136,135,203,184,198,172]}","{""name"":""a \\""white\\"" swan, good fortune""}"\nsinus_test_pattern.jpg,27894,"{""caption"":""  ""}",3,0,"{""name"":""ellipse"",""cx"":300,""cy"":223,""rx"":93,""ry"":56}","{""name"":""ellipse on \\""yellow\\""; background""}"\nsinus_test_pattern.jpg,27894,"{""caption"":""  ""}",3,1,"{""name"":""rect"",""x"":79,""y"":310,""width"":66,""height"":62}","{""name"":""a \'rect\' in \\""blue\\"", background""}"\nsinus_test_pattern.jpg,27894,"{""caption"":""  ""}",3,2,"{""name"":""point"",""cx"":505,""cy"":113}","{""name"":""a point, in infinity, $, :""}"';

    var blob = new Blob( [d], {type: 'text/csv;charset=utf-8'});

    // simulate a csv file import
    load_text_file(blob, import_annotations_from_csv);

    var tests = []
    tests.push('Object.keys(_via_img_metadata).length === 3');
    tests.push('_via_img_metadata["a_swan_swimming_in_geneve_lake.jpg62201"].regions.length === 1');
    tests.push('_via_img_metadata["sinus_test_pattern.jpg27894"].regions.length === 3');
    tests.push('_via_img_metadata["test_pattern_qbist.jpg129855"].regions.length === 8');

    // run the tests after some delay
    _via_run_test( tests, 1000 );
}

function _via_test_json_import() {
    _via_load_test_img();
    // note :
    // - all \" has been replaced with \\"
    // - all ' has been replaced with \'
    var d = '{"test_pattern_qbist.jpg129855":{"fileref":"","size":129855,"filename":"test_pattern_qbist.jpg","base64_img_data":"","file_attributes":{"caption":"+-08374*&$£*"},"regions":{"0":{"shape_attributes":{"name":"ellipse","cx":252,"cy":190,"rx":27,"ry":26},"region_attributes":{"name":"ellipse \\"red\\""}},"1":{"shape_attributes":{"name":"rect","x":290,"y":208,"width":127,"height":113},"region_attributes":{"name":"rectangle \'black\'"}},"2":{"shape_attributes":{"name":"point","cx":51,"cy":37},"region_attributes":{"name":"red \\\"dot\\\""}},"3":{"shape_attributes":{"name":"point","cx":253,"cy":40},"region_attributes":{"name":"unknown 598 fjs £$ *(&£^"}},"4":{"shape_attributes":{"name":"point","cx":453,"cy":37},"region_attributes":{"name":"1564865"}},"5":{"shape_attributes":{"name":"circle","cx":148,"cy":268,"r":43},"region_attributes":{}},"6":{"shape_attributes":{"name":"ellipse","cx":554,"cy":255,"rx":33,"ry":57},"region_attributes":{}},"7":{"shape_attributes":{"name":"point","cx":638,"cy":475},"region_attributes":{}}}},"a_swan_swimming_in_geneve_lake.jpg62201":{"fileref":"","size":62201,"filename":"a_swan_swimming_in_geneve_lake.jpg","base64_img_data":"","file_attributes":{"caption":"a swan in geneve lake\\\""},"regions":{"0":{"shape_attributes":{"name":"polygon","all_points_x":[121,105,188,405,406,428,403,338,327,225,159,121],"all_points_y":[172,212,292,299,238,219,136,135,203,184,198,172]},"region_attributes":{"name":"a \\\"white\\\" swan, good fortune"}}}},"sinus_test_pattern.jpg27894":{"fileref":"","size":27894,"filename":"sinus_test_pattern.jpg","base64_img_data":"","file_attributes":{"caption":"  "},"regions":{"0":{"shape_attributes":{"name":"ellipse","cx":300,"cy":223,"rx":93,"ry":56},"region_attributes":{"name":"ellipse on \\\"yellow\\\"; background"}},"1":{"shape_attributes":{"name":"rect","x":79,"y":310,"width":66,"height":62},"region_attributes":{"name":"a \'rect\' in \\"blue\\", background"}},"2":{"shape_attributes":{"name":"point","cx":505,"cy":113},"region_attributes":{"name":"a point, in infinity, $, :"}}}}}';

    var blob = new Blob( [d], {type: 'text/json;charset=utf-8'});

    // simulate a csv file import
    load_text_file(blob, import_annotations_from_json);

    var tests = []

    console.log(Object.keys(_via_img_metadata));
    tests.push('Object.keys(_via_img_metadata).length === 3');
    tests.push('_via_img_metadata["a_swan_swimming_in_geneve_lake.jpg62201"].regions.length === 1');
    tests.push('_via_img_metadata["sinus_test_pattern.jpg27894"].regions.length === 3');
    tests.push('_via_img_metadata["test_pattern_qbist.jpg129855"].regions.length === 8');

    // run the tests after some delay
    _via_run_test( tests, 1000 );
}