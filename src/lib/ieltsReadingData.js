// Dữ liệu tĩnh cho mục "ĐỌC HIỂU" của IELTS Reading — trích trực tiếp từ tài liệu Word đã soạn
// sẵn (Input/04 TEST 2- PASSAGE 1.docx, KHÔNG đẩy lên GitHub vì Input/ nằm trong .gitignore).
// Mỗi bài chia thành từng câu: câu tiếng Anh + bản dịch tiếng Việt + danh sách từ vựng/từ đồng
// nghĩa xuất hiện trong câu đó — đúng bố cục bảng 2 cột trong file Word gốc.
// Đây MỚI LÀ 1 bài thử nghiệm đầu tiên (Test 2 – Passage 1), chưa phải kho dữ liệu đầy đủ.
export const IELTS_READING_COMPREHENSION = [
  {
    id: "test2-passage1",
    titleEn: "SHEET GLASS MANUFACTURE: THE FLOAT PROCESS",
    titleVi: "SẢN XUẤT KÍNH TẤM: QUY TRÌNH NỔI",
    // File audio đọc toàn bộ bài (giọng đọc tự thu/tự tạo, KHÔNG phải audio gốc có bản quyền của
    // đề thi) — dán URL sau khi upload qua Cloudinary (giống cơ chế AudioUploadField ở CMS Reading
    // YLE), xem CLAUDE.md mục 2. Để trống thì màn ĐỌC HIỂU chỉ hiện nút xem bản tiếng Anh đầy đủ.
    audioUrl: "",
    sentences: [
      { en: "Glass, which has been made since the time of the Mesopotamians /ˌmesəpəˈteɪmiənz/ and Egyptians /ɪˈdʒɪpʃənz/, is little more than a mixture /ˈmɪkstʃə/ of sand, soda ash and lime.", vi: "Thủy tinh, vốn đã được sản xuất từ thời người Lưỡng Hà và người Ai Cập, về cơ bản chỉ là một hỗn hợp gồm cát, tro soda và vôi.", vocab: [
        { termDef: "be little more than = be essentially / be basically", meaning: "về cơ bản chỉ là" },
        { termDef: "mixture = combination / blend", meaning: "hỗn hợp" },
      ] },
      { en: "When heated /ˈhiːtɪd/ to about 1500 degrees Celsius (°C) this becomes a molten /ˈməʊltn/ mass /mæs/ that hardens /ˈhɑːdnz/ when slowly cooled.", vi: "Khi được đun nóng đến khoảng 1.500 độ C, hỗn hợp này trở thành một khối nóng chảy và cứng lại khi được làm nguội từ từ.", vocab: [
        { termDef: "molten = melted / liquefied", meaning: "nóng chảy" },
        { termDef: "mass = large amount / body", meaning: "khối" },
        { termDef: "harden = become solid / solidify", meaning: "cứng lại, đông cứng" },
        { termDef: "cool = lower the temperature / chill", meaning: "làm nguội" },
      ] },
      { en: "The first successful method for making clear, flat glass involved spinning.", vi: "Phương pháp thành công đầu tiên để sản xuất thủy tinh trong, phẳng là sử dụng kỹ thuật quay.", vocab: [
        { termDef: "method = technique / procedure", meaning: "phương pháp" },
        { termDef: "involve = include / entail", meaning: "bao gồm, liên quan đến" },
      ] },
      { en: "This method was very effective /ɪˈfektɪv/ as the glass had not touched any surfaces /ˈsɜːfɪsɪz/ between being soft and becoming hard, so it stayed perfectly unblemished /ʌnˈblemɪʃt/, with a 'fire finish'.", vi: "Phương pháp này rất hiệu quả vì thủy tinh không chạm vào bất kỳ bề mặt nào trong khoảng thời gian từ khi còn mềm đến khi trở nên cứng, vì vậy nó vẫn hoàn toàn không tì vết, với một “bề mặt hoàn thiện bằng lửa”.", vocab: [
        { termDef: "effective = successful / efficient", meaning: "hiệu quả" },
        { termDef: "surface = exterior / outer layer", meaning: "bề mặt" },
        { termDef: "unblemished = flawless / spotless", meaning: "không tì vết, hoàn hảo" },
        { termDef: "finish = final surface / final appearance", meaning: "bề mặt hoàn thiện" },
      ] },
      { en: "However, the process /ˈprəʊses/ took a long time and was labour-intensive /ˈleɪbə(r) ɪnˌtensɪv/.", vi: "Tuy nhiên, quá trình này mất nhiều thời gian và đòi hỏi nhiều công sức lao động.", vocab: [
        { termDef: "process = procedure / operation", meaning: "quá trình" },
        { termDef: "labour-intensive = requiring a lot of labour / labour-consuming", meaning: "cần nhiều nhân công, tốn nhiều công sức lao động" },
      ] },
      { en: "Nevertheless /ˌnevəðəˈles/, demand for flat glass was very high and glassmakers across the world were looking for a method /ˈmeθəd/ of making it continuously /kənˈtɪnjuəsli/.", vi: "Tuy nhiên, nhu cầu về thủy tinh phẳng rất cao và các nhà sản xuất thủy tinh trên khắp thế giới đang tìm kiếm một phương pháp để sản xuất nó liên tục.", vocab: [
        { termDef: "nevertheless = however / nonetheless", meaning: "tuy nhiên" },
        { termDef: "demand for something = need for something", meaning: "nhu cầu về cái gì" },
        { termDef: "across the world = around the world / worldwide", meaning: "trên khắp thế giới" },
        { termDef: "method = way / technique", meaning: "phương pháp" },
        { termDef: "continuously = without stopping / continually", meaning: "liên tục" },
      ] },
      { en: "The first continuous ribbon process involved squeezing molten /ˈməʊltn/ glass through two hot rollers /ˈrəʊləz/, similar to an old mangle.", vi: "Quy trình dải liên tục đầu tiên bao gồm việc ép thủy tinh nóng chảy đi qua hai con lăn nóng, tương tự như một chiếc máy cán kiểu cũ.", vocab: [
        { termDef: "continuous = uninterrupted / ongoing", meaning: "liên tục" },
        { termDef: "process = procedure / method", meaning: "quy trình" },
        { termDef: "involve = include / entail", meaning: "bao gồm" },
        { termDef: "squeeze = press / compress", meaning: "ép, nén" },
        { termDef: "molten = melted", meaning: "nóng chảy" },
      ] },
      { en: "This allowed glass of virtually /ˈvɜːtʃuəli/ any thickness /ˈθɪknəs/ to be made non-stop, but the rollers would leave both sides of the glass marked, and these would then need to be ground /ɡraʊnd/ and polished /ˈpɒlɪʃt/.", vi: "Điều này cho phép sản xuất thủy tinh với hầu như bất kỳ độ dày nào một cách không ngừng, nhưng các con lăn sẽ để lại vết trên cả hai mặt của kính, và sau đó những vết này cần được mài và đánh bóng.", vocab: [
        { termDef: "virtually = almost / nearly", meaning: "hầu như, gần như" },
        { termDef: "thickness = depth", meaning: "độ dày" },
        { termDef: "non-stop = continuously / without stopping", meaning: "không ngừng" },
        { termDef: "leave something marked = leave marks on something", meaning: "để lại vết trên cái gì" },
        { termDef: "grind = rub down / wear away", meaning: "mài" },
        { termDef: "polish = make smooth / shine", meaning: "đánh bóng" },
      ] },
      { en: "This part of the process rubbed away around 20 per cent of the glass, and the machines were very expensive /ɪkˈspensɪv/.", vi: "Phần này của quy trình làm mài đi khoảng 20% lượng thủy tinh, và máy móc thì rất đắt tiền.", vocab: [
        { termDef: "rub away = wear away / remove gradually", meaning: "làm mòn, mài đi" },
        { termDef: "expensive = costly / high-priced", meaning: "đắt tiền" },
      ] },
      { en: "The float process for making flat glass was invented /ɪnˈventɪd/ by Alistair Pilkington.", vi: "Quy trình float để sản xuất thủy tinh phẳng được phát minh bởi Alistair Pilkington.", vocab: [
        { termDef: "invent = devise / create", meaning: "phát minh, sáng chế" },
      ] },
      { en: "This process allows the manufacture /ˌmænjuˈfæktʃə(r)/ of clear, tinted /ˈtɪntɪd/ and coated glass for buildings, and clear and tinted glass for vehicles /ˈviːəklz/.", vi: "Quy trình này cho phép sản xuất thủy tinh trong suốt, có màu và được phủ cho các tòa nhà, cũng như thủy tinh trong suốt và có màu cho các phương tiện.", vocab: [
        { termDef: "manufacture = production / making", meaning: "sự sản xuất" },
        { termDef: "tinted = coloured", meaning: "có màu, được nhuộm màu" },
        { termDef: "coated = covered with a layer", meaning: "được phủ một lớp" },
        { termDef: "vehicle = means of transport", meaning: "phương tiện" },
      ] },
      { en: "Pilkington had been experimenting /ɪkˈsperɪmentɪŋ/ with improving the melting process, and in 1952 he had the idea of using a bed of molten metal to form the flat glass, eliminating /ɪˈlɪmɪneɪtɪŋ/ altogether /ˌɔːltəˈɡeðə(r)/ the need for rollers within the float bath.", vi: "Pilkington đã thử nghiệm việc cải tiến quá trình nung chảy, và vào năm 1952, ông nảy ra ý tưởng sử dụng một lớp kim loại nóng chảy để tạo thành thủy tinh phẳng, qua đó loại bỏ hoàn toàn nhu cầu sử dụng các con lăn trong bể float.", vocab: [
        { termDef: "experiment with = try out / test", meaning: "thử nghiệm" },
        { termDef: "improve = make better / enhance", meaning: "cải thiện" },
        { termDef: "have the idea of doing something = think of doing something", meaning: "nảy ra ý tưởng làm gì" },
        { termDef: "form = shape / create", meaning: "tạo thành" },
        { termDef: "eliminate = remove / get rid of", meaning: "loại bỏ" },
        { termDef: "altogether = completely / entirely", meaning: "hoàn toàn" },
      ] },
      { en: "The metal had to melt at a temperature /ˈtemprətʃə(r)/ less than the hardening /ˈhɑːdnɪŋ/ point of glass (about 600°C), but could not boil at a temperature below the temperature of the molten glass (about 1500°C).", vi: "Kim loại phải nóng chảy ở nhiệt độ thấp hơn điểm đông cứng của thủy tinh (khoảng 600°C), nhưng không được sôi ở nhiệt độ thấp hơn nhiệt độ của thủy tinh nóng chảy (khoảng 1.500°C).", vocab: [
        { termDef: "melt = become liquid / liquefy", meaning: "nóng chảy" },
        { termDef: "temperature = degree of heat", meaning: "nhiệt độ" },
        { termDef: "hardening point", meaning: "điểm đông cứng" },
        { termDef: "boil = reach boiling point", meaning: "sôi" },
      ] },
      { en: "The best metal for the job was tin.", vi: "Kim loại phù hợp nhất cho công việc này là thiếc.", vocab: [
        { termDef: "for the job = suitable for the purpose", meaning: "phù hợp cho công việc / mục đích đó" },
      ] },
      { en: "The rest of the concept /ˈkɒnsept/ relied on gravity /ˈɡrævəti/, which guaranteed /ˌɡærənˈtiːd/ that the surface /ˈsɜːfɪs/ of the molten metal was perfectly flat and horizontal /ˌhɒrɪˈzɒntl/.", vi: "Phần còn lại của ý tưởng dựa vào trọng lực, điều này đảm bảo rằng bề mặt của kim loại nóng chảy hoàn toàn phẳng và nằm ngang.", vocab: [
        { termDef: "rely on = depend on", meaning: "dựa vào, phụ thuộc vào" },
        { termDef: "gravity", meaning: "trọng lực" },
        { termDef: "guarantee = ensure", meaning: "đảm bảo" },
        { termDef: "surface = outer layer", meaning: "bề mặt" },
        { termDef: "horizontal = level / flat", meaning: "nằm ngang" },
      ] },
      { en: "Consequently /ˈkɒnsɪkwəntli/, when pouring /ˈpɔːrɪŋ/ molten glass onto the molten tin, the underside /ˈʌndəsaɪd/ of the glass would also be perfectly flat.", vi: "Do đó, khi đổ thủy tinh nóng chảy lên thiếc nóng chảy, mặt dưới của thủy tinh cũng sẽ hoàn toàn phẳng.", vocab: [
        { termDef: "consequently = therefore / as a result", meaning: "do đó, vì vậy" },
        { termDef: "pour ... onto", meaning: "đổ ... lên" },
        { termDef: "underside = bottom surface", meaning: "mặt dưới" },
      ] },
      { en: "If the glass were kept hot enough, it would flow over the molten tin until the top surface was also flat, horizontal and perfectly parallel /ˈpærəlel/ to the bottom surface.", vi: "Nếu thủy tinh được giữ đủ nóng, nó sẽ chảy trên lớp thiếc nóng chảy cho đến khi bề mặt phía trên cũng phẳng, nằm ngang và hoàn toàn song song với bề mặt phía dưới.", vocab: [
        { termDef: "flow = move smoothly / run", meaning: "chảy" },
        { termDef: "top surface", meaning: "bề mặt phía trên" },
        { termDef: "parallel to", meaning: "song song với" },
        { termDef: "bottom surface", meaning: "bề mặt phía dưới" },
      ] },
      { en: "Once the glass cooled /kuːld/ to 604°C or less it was too hard to mark and could be transported /trænˈspɔːtɪd/ out of the cooling zone /zuːn/ by rollers.", vi: "Khi thủy tinh nguội xuống 604°C hoặc thấp hơn, nó đã quá cứng để bị tạo vết và có thể được các con lăn vận chuyển ra khỏi khu vực làm nguội.", vocab: [
        { termDef: "cool = become less hot", meaning: "nguội đi" },
        { termDef: "transport = move / carry", meaning: "vận chuyển" },
        { termDef: "zone = area / region", meaning: "khu vực" },
      ] },
      { en: "The glass settled to a thickness /ˈθɪknəs/ of six millimetres because of surface tension /ˈtenʃn/ interactions /ˌɪntərˈækʃnz/ between the glass and the tin.", vi: "Thủy tinh ổn định ở độ dày sáu mi-li-mét do sự tương tác của sức căng bề mặt giữa thủy tinh và thiếc.", vocab: [
        { termDef: "settle to = become stable at", meaning: "ổn định ở mức" },
        { termDef: "thickness", meaning: "độ dày" },
        { termDef: "surface tension", meaning: "sức căng bề mặt" },
        { termDef: "interaction = relationship / effect", meaning: "sự tương tác" },
      ] },
      { en: "By fortunate /ˈfɔːtʃənət/ coincidence /kəʊˈɪnsɪdəns/, 60 per cent of the flat glass market at that time was for six-millimetre glass.", vi: "Thật trùng hợp may mắn, vào thời điểm đó, 60% thị trường thủy tinh phẳng là dành cho loại thủy tinh dày sáu mi-li-mét.", vocab: [
        { termDef: "fortunate = lucky", meaning: "may mắn" },
        { termDef: "coincidence = chance occurrence", meaning: "sự trùng hợp ngẫu nhiên" },
        { termDef: "at that time = then", meaning: "vào thời điểm đó" },
      ] },
      { en: "Pilkington built a pilot plant /ˈpaɪlət plɑːnt/ in 1953 and by 1955 he had convinced /kənˈvɪnst/ his company to build a full-scale /ˌfʊl ˈskeɪl/ plant.", vi: "Pilkington đã xây dựng một nhà máy thí điểm vào năm 1953 và đến năm 1955, ông đã thuyết phục công ty của mình xây dựng một nhà máy quy mô đầy đủ.", vocab: [
        { termDef: "pilot plant", meaning: "nhà máy thí điểm" },
        { termDef: "convince = persuade", meaning: "thuyết phục" },
        { termDef: "full-scale = complete / fully developed", meaning: "quy mô đầy đủ" },
      ] },
      { en: "However, it took 14 months of non-stop production /prəˈdʌkʃn/, costing the company £100,000 a month, before the plant produced any usable /ˈjuːzəbl/ glass.", vi: "Tuy nhiên, phải mất 14 tháng sản xuất không ngừng, tiêu tốn của công ty 100.000 bảng Anh mỗi tháng, trước khi nhà máy sản xuất được bất kỳ loại thủy tinh nào có thể sử dụng được.", vocab: [
        { termDef: "non-stop = continuous / uninterrupted", meaning: "không ngừng, liên tục" },
        { termDef: "production = manufacture / manufacturing", meaning: "sự sản xuất" },
        { termDef: "usable = useful / fit for use", meaning: "có thể sử dụng được" },
      ] },
      { en: "Furthermore /ˌfɜːðəˈmɔː(r)/, once they succeeded /səkˈsiːdɪd/ in making marketable /ˈmɑːkɪtəbl/ flat glass, the machine was turned off for a service /ˈsɜːvɪs/ to prepare it for years of continuous production.", vi: "Hơn nữa, một khi họ thành công trong việc sản xuất thủy tinh phẳng có thể đưa ra thị trường, chiếc máy đã được tắt để bảo dưỡng nhằm chuẩn bị cho nhiều năm sản xuất liên tục.", vocab: [
        { termDef: "furthermore = moreover / in addition", meaning: "hơn nữa" },
        { termDef: "succeed in doing something = manage to do something", meaning: "thành công trong việc làm gì" },
        { termDef: "marketable = saleable / fit for sale", meaning: "có thể đưa ra thị trường" },
        { termDef: "turn off = switch off", meaning: "tắt" },
        { termDef: "service = maintenance", meaning: "việc bảo dưỡng" },
        { termDef: "prepare for = get ready for", meaning: "chuẩn bị cho" },
      ] },
      { en: "When it started up /stɑːtɪd ʌp/ again it took another four months to get the process right again.", vi: "Khi nó hoạt động trở lại, phải mất thêm bốn tháng nữa để làm cho quy trình hoạt động đúng như mong muốn.", vocab: [
        { termDef: "start up = begin operating", meaning: "bắt đầu hoạt động" },
        { termDef: "get something right = do something correctly", meaning: "làm cho điều gì đó đúng / chính xác" },
      ] },
      { en: "They finally succeeded in 1959 and there are now float plants all over the world, with each able to produce around 1000 tons of glass every day, non-stop for around 15 years.", vi: "Cuối cùng họ đã thành công vào năm 1959, và hiện nay có các nhà máy sản xuất thủy tinh bằng quy trình float trên khắp thế giới, mỗi nhà máy có khả năng sản xuất khoảng 1.000 tấn thủy tinh mỗi ngày, liên tục trong khoảng 15 năm.", vocab: [
        { termDef: "finally = eventually / at last", meaning: "cuối cùng" },
        { termDef: "all over the world = worldwide / around the world", meaning: "trên khắp thế giới" },
        { termDef: "be able to = have the ability to", meaning: "có khả năng" },
        { termDef: "produce = manufacture / make", meaning: "sản xuất" },
      ] },
      { en: "The principle /ˈprɪnsəpl/ of float glass is unchanged /ʌnˈtʃeɪndʒd/ since the 1950s. However, the product has changed dramatically /drəˈmætɪkli/, from a single thickness of 6.8 mm to a range from sub-millimetre to 25 mm, from a ribbon frequently marred /mɑːd/ by inclusions /ɪnˈkluːʒənz/ and bubbles to almost optical perfection.", vi: "Nguyên lý của kính nổi không thay đổi kể từ những năm 1950. Tuy nhiên, sản phẩm đã thay đổi đáng kể, từ một độ dày duy nhất 6,8 mm đến một phạm vi từ dưới một milimét đến 25 mm, từ một dải kính thường bị các tạp chất và bong bóng làm khiếm khuyết đến mức gần như hoàn hảo về mặt quang học.", vocab: [
        { termDef: "principle = fundamental idea", meaning: "nguyên lý" },
        { termDef: "unchanged = unaltered", meaning: "không thay đổi" },
        { termDef: "dramatically = significantly", meaning: "đáng kể, mạnh mẽ" },
        { termDef: "marred by = damaged by", meaning: "bị làm khiếm khuyết bởi" },
        { termDef: "inclusion = impurity / foreign material", meaning: "tạp chất" },
      ] },
      { en: "To ensure /ɪnˈʃʊə(r)/ the highest quality, inspection /ɪnˈspekʃn/ takes place at every stage. Occasionally /əˈkeɪʒənəli/, a bubble is not removed during refining /rɪˈfaɪnɪŋ/, a sand grain refuses to melt, a tremor /ˈtremə(r)/ in the tin puts ripples /ˈrɪplz/ into the glass ribbon.", vi: "Để đảm bảo chất lượng cao nhất, việc kiểm tra được tiến hành ở mọi giai đoạn. Thỉnh thoảng, một bong bóng không được loại bỏ trong quá trình tinh luyện, một hạt cát không tan chảy, hoặc một chấn động trong thiếc tạo ra những gợn sóng trên dải kính.", vocab: [
        { termDef: "ensure = make certain", meaning: "đảm bảo" },
        { termDef: "inspection = examination / checking", meaning: "sự kiểm tra" },
        { termDef: "occasionally = sometimes", meaning: "thỉnh thoảng" },
        { termDef: "refining = purification", meaning: "quá trình tinh luyện" },
        { termDef: "tremor = slight shaking", meaning: "chấn động nhẹ" },
        { termDef: "ripple = small wave", meaning: "gợn sóng" },
      ] },
      { en: "Automated /ˈɔːtəmeɪtɪd/ on-line inspection does two things. Firstly, it reveals /rɪˈviːlz/ process faults /fɔːlts/ upstream /ˌʌpˈstriːm/ that can be corrected. Inspection technology allows more than 100 million measurements a second to be made across the ribbon, locating flaws /flɔːz/ the unaided /ʌnˈeɪdɪd/ eye would be unable to see.", vi: "Việc kiểm tra trực tuyến tự động thực hiện hai chức năng. Thứ nhất, nó phát hiện các lỗi trong quy trình ở phía trước để có thể được sửa chữa. Công nghệ kiểm tra cho phép thực hiện hơn 100 triệu phép đo mỗi giây trên toàn bộ dải kính, xác định những khuyết tật mà mắt thường không thể nhìn thấy.", vocab: [
        { termDef: "automated = automatic", meaning: "tự động" },
        { termDef: "reveal = detect / show", meaning: "phát hiện, cho thấy" },
        { termDef: "fault = defect / error", meaning: "lỗi, khiếm khuyết" },
        { termDef: "upstream", meaning: "ở công đoạn trước / phía trước trong quy trình" },
        { termDef: "flaw = defect / imperfection", meaning: "khuyết tật" },
        { termDef: "unaided = without assistance", meaning: "không có sự hỗ trợ" },
      ] },
      { en: "Secondly, it enables /ɪˈneɪblz/ computers downstream /ˌdaʊnˈstriːm/ to steer /stɪə(r)/ cutters around flaws.", vi: "Thứ hai, nó cho phép máy tính ở công đoạn phía sau điều khiển các máy cắt tránh những chỗ bị khuyết tật.", vocab: [
        { termDef: "enable = allow / permit", meaning: "cho phép" },
        { termDef: "downstream", meaning: "ở công đoạn sau / phía sau trong quy trình" },
        { termDef: "steer = direct / guide", meaning: "điều khiển, hướng" },
        { termDef: "cutter = cutting machine", meaning: "máy cắt" },
      ] },
      { en: "Float glass is sold by the square metre, and at the final stage computers translate customer requirements into patterns of cuts designed to minimise /ˈmɪnɪmaɪz/ waste.", vi: "Kính nổi được bán theo mét vuông, và ở giai đoạn cuối, máy tính chuyển các yêu cầu của khách hàng thành các mẫu cắt được thiết kế để giảm thiểu lượng phế liệu.", vocab: [
        { termDef: "requirement = need / demand", meaning: "yêu cầu" },
        { termDef: "translate A into B = convert A into B", meaning: "chuyển A thành B" },
        { termDef: "minimise = reduce", meaning: "giảm thiểu" },
        { termDef: "waste = unwanted material", meaning: "chất thải / phế liệu" },
      ] },
    ],
  },
];
